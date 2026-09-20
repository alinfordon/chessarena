const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const cookie = require('cookie');
const { sanitizeText, isValidId } = require('../utils/validation');
const { calculateEloRating, getRatingCategory } = require('../lib/rating.js');
const { formatTime } = require('../utils/time');

(function loadDotEnvFiles() {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '..');
  for (const f of ['.env.local', '.env']) {
    try {
      const full = path.join(root, f);
      const content = fs.readFileSync(full, 'utf8');
      for (const raw of content.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) continue;
        const eq = line.indexOf('=');
        let key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if (/^['"]/.test(val) && val.length >= 2 && val.endsWith(val[0])) val = val.slice(1, -1);
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch {}
  }
})();

const PORT = process.env.SOCKET_PORT || process.env.PORT || 3001;
const NEXT_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const AUTH_SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'chess-arena-dev-secret-change-in-production'
);
const AUTH_COOKIE_NAME = 'chess_arena_token';

let mongoose;
try {
  mongoose = require('mongoose');
} catch (e) {
  mongoose = null;
}

function slimLobbyGame(g) {
  if (!g) return null;
  return {
    gameId: g.gameId,
    status: g.status,
    initialTime: g.initialTime,
    increment: g.increment,
    whiteUsername: g.whiteUsername || null,
    blackUsername: g.blackUsername || null,
    whiteRating: g.whiteRating ?? null,
    blackRating: g.blackRating ?? null,
    movesCount: Array.isArray(g.moves) ? g.moves.length : 0,
    isPrivate: !!g.isPrivate,
    ratingCategory: g.ratingCategory || null,
    startedAt: g.startedAt || null,
    createdAt: g.createdAt || null,
  };
}

async function broadcastLobbyGame(gameId, extra = {}) {
  try {
    const { Game } = await getModels();
    if (!Game || !gameId) {
      io.emit('lobby:update', { gameId, ...extra });
      return;
    }
    const doc = await Game.findOne({ gameId }).lean();
    const slim = slimLobbyGame(doc);
    if (slim) {
      io.emit('lobby:new-game', slim);
      io.emit('lobby:update', { game: { ...slim, ...extra } });
    } else {
      io.emit('lobby:update', { gameId, ...extra });
    }
  } catch (e) {
    logError('LobbyBroadcast', e);
    io.emit('lobby:update', { gameId, ...extra });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/notify') {
      const type = url.searchParams.get('type');
      const gameId = url.searchParams.get('gameId');
      if ((type === 'lobby-new' || type === 'lobby-update') && gameId) {
        await broadcastLobbyGame(gameId, type === 'lobby-new' ? { status: 'waiting' } : {});
      }
      if (type === 'game-sync' && gameId) {
        await syncAndBroadcastGame(gameId);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
  } catch (e) {
    logError('HTTP', e);
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'ok',
      socket: 'Chess Arena Socket Server',
      uptime: process.uptime(),
      games: gameManagers.size,
      online: userSockets.size,
      queues: quickMatchQueues.size,
    })
  );
});

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = new Set(
        [
          NEXT_APP_URL,
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
        ].filter(Boolean)
      );
      if (allowed.has(origin)) return cb(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['polling', 'websocket'],
  pingInterval: 10000,
  pingTimeout: 15000,
});

const gameManagers = new Map();
const userSockets = new Map();
const chatRateLimit = new Map();
const moveRateLimit = new Map();
const pendingOffline = new Map();
const quickMatchQueues = new Map();
const tournamentManagers = new Map();

const RATE_LIMIT_MS = 1000;
const MAX_MESSAGES_PER_MINUTE = 20;
const MAX_MOVES_PER_SECOND = 2;
const OFFLINE_DEBOUNCE_MS = 10000;

function log(prefix, ...args) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] [${prefix}]`, ...args);
}

function logError(prefix, err) {
  const ts = new Date().toISOString().substring(11, 19);
  console.error(`[${ts}] [${prefix}]`, err?.message || err, err?.stack || '');
}

function mongoId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    return value === '[object Object]' ? null : value;
  }
  if (typeof value !== 'object') return String(value);
  if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') {
    return String(value);
  }
  if (typeof value.toHexString === 'function') {
    try {
      return value.toHexString();
    } catch {}
  }
  if (value._id && value._id !== value) return mongoId(value._id);
  if (typeof value.toString === 'function') {
    const s = value.toString();
    if (s && s !== '[object Object]') return s;
  }
  return null;
}

function applyDocToManager(gm, doc) {
  if (!gm || !doc) return;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  gm.data.whitePlayer = mongoId(obj.whitePlayer);
  gm.data.blackPlayer = mongoId(obj.blackPlayer);
  gm.data.whiteUsername = obj.whiteUsername || null;
  gm.data.blackUsername = obj.blackUsername || null;
  gm.data.whiteRating = obj.whiteRating ?? gm.data.whiteRating;
  gm.data.blackRating = obj.blackRating ?? gm.data.blackRating;
  gm.data.status = obj.status || gm.data.status;
  gm.data.startedAt = obj.startedAt || gm.data.startedAt;
  gm.data.finishedAt = obj.finishedAt || gm.data.finishedAt;
  gm.data.fen = obj.fen || gm.data.fen;
  gm.data.turn = obj.turn || gm.data.turn;
  gm.data.whiteTime = obj.whiteTime ?? gm.data.whiteTime;
  gm.data.blackTime = obj.blackTime ?? gm.data.blackTime;
  gm.data.result = obj.result ?? gm.data.result;
  gm.data.termination = obj.termination ?? gm.data.termination;
  if (Array.isArray(obj.moves)) gm.data.moves = obj.moves;
}

function emitGameRoom(gameId, gm) {
  if (!gm || !gameId) return;
  const state = gm.getState();
  io.to(`game:${gameId}`).emit('game:state', state);
  io.to(`game:${gameId}`).emit('game:clock', {
    gameId,
    whiteTime: state.whiteTime,
    blackTime: state.blackTime,
    turn: state.turn,
  });
}

let _modelsReady = false;
let _Game = null;
let _User = null;
let _Message = null;
let _Tournament = null;
let _TournamentPlayer = null;
let _BannedUser = null;
let _BotUserId = null;
const _botMoveTimers = new Map();
const _antiCheatStats = new Map();

async function ensureBotUser() {
  if (_BotUserId) return _BotUserId;
  if (!mongoose) return null;
  const { User } = await getModels();
  if (!User) return null;
  try {
    let bot = await User.findOne({ username: 'Bot_Stockfish' }).select('_id');
    if (!bot) {
      const bcrypt = require('bcryptjs');
      const salt = bcrypt.genSaltSync(12);
      const passwordHash = bcrypt.hashSync('bot-password-' + Date.now(), salt);
      bot = await User.create({
        username: 'Bot_Stockfish',
        email: 'bot@stockfish.chess',
        passwordHash,
        rating: 1600,
        blitzRating: 1600,
        rapidRating: 1600,
        classicalRating: 1600,
      });
    }
    _BotUserId = bot._id.toString();
    return _BotUserId;
  } catch (e) {
    logError('Bot', new Error('Bot user create failed: ' + e.message));
    return null;
  }
}

function isBotPlayer(data) {
  if (!_BotUserId) return false;
  return (
    String(data.whitePlayer || '') === String(_BotUserId) ||
    String(data.blackPlayer || '') === String(_BotUserId)
  );
}

function isBotTurn(data) {
  if (!_BotUserId || data.status !== 'playing') return false;
  if (data.turn === 'w') return String(data.whitePlayer || '') === String(_BotUserId);
  if (data.turn === 'b') return String(data.blackPlayer || '') === String(_BotUserId);
  return false;
}

function pickBotMove(chess, level) {
  try {
    const moves = chess.moves({ verbose: true });
    if (!moves || moves.length === 0) return null;

    const captures = moves.filter(m => m.captured);
    const checks = moves.filter(m => m.san && m.san.includes('+'));
    const promotions = moves.filter(m => m.promotion);

    const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (level >= 9 && promotions.length > 0 && Math.random() < 0.95) return pickRandom(promotions);
    if (level >= 6 && captures.length > 0 && Math.random() < (0.4 + level * 0.05)) return pickRandom(captures);
    if (level >= 4 && checks.length > 0 && Math.random() < (0.3 + level * 0.04)) return pickRandom(checks);

    const centerSquares = ['d4', 'd5', 'e4', 'e5', 'c3', 'c6', 'f3', 'f6', 'c4', 'c5', 'f4', 'f5'];
    if (level >= 3 && Math.random() < (0.2 + level * 0.05)) {
      const centerMoves = moves.filter(m => centerSquares.includes(m.to) || centerSquares.includes(m.from));
      if (centerMoves.length > 0) return pickRandom(centerMoves);
    }

    if (level <= 2 && Math.random() < 0.25) return pickRandom(moves);

    const valued = moves.map(m => {
      let score = Math.random() * (10 - level) * 10;
      if (m.captured) score += { p: 10, n: 30, b: 30, r: 50, q: 90 }[m.captured] || 0;
      if (m.promotion === 'q') score += 80;
      if (m.flags && m.flags.includes('p')) score += 5;
      if (m.san && m.san.includes('+')) score += 8;
      if (m.san && m.san.includes('#')) score += 9999;
      return { m, score };
    });
    valued.sort((a, b) => b.score - a.score);
    const topN = Math.max(1, Math.min(moves.length, Math.max(1, 11 - level)));
    const pool = valued.slice(0, topN);
    return pool[Math.floor(Math.random() * pool.length)].m;
  } catch (e) {
    logError('Bot', e);
    const moves = chess.moves({ verbose: true });
    if (!moves || moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }
}

async function triggerBotMove(gm, gameId) {
  if (!_BotUserId) return;
  if (!isBotTurn(gm.data)) return;
  if (_botMoveTimers.has(gameId)) return;

  const botLevel = Number(gm.data.botLevel) || 5;
  const delayMs = Math.max(300, Math.min(3000, 300 + (10 - botLevel) * 250 + Math.random() * 500));

  _botMoveTimers.set(gameId, true);

  setTimeout(() => {
    (async () => {
      _botMoveTimers.delete(gameId);
      try {
        if (!isBotTurn(gm.data)) return;
        const move = pickBotMove(gm.chess, botLevel);
        if (!move) return;
        const res = gm.makeMove(_BotUserId, move.from, move.to, move.promotion);
        if (!res.ok) {
          log('Bot', `Bot move failed in ${gameId}: ${res.error}`);
          return;
        }
        io.to(`game:${gameId}`).emit('game:state', res.state);
        io.to(`game:${gameId}`).emit('game:clock', {
          whiteTime: res.state.whiteTime,
          blackTime: res.state.blackTime,
          turn: res.state.turn,
        });
        if (res.finished) {
          io.to(`game:${gameId}`).emit('game:finished', {
            result: res.state.result,
            termination: res.state.termination,
          });
          log('Bot', `Bot finished game ${gameId}: ${res.state.result}`);
        }
        await gm.save();
        if (!res.finished && isBotTurn(gm.data)) {
          setTimeout(() => triggerBotMove(gm, gameId), 50);
        }
      } catch (e) {
        logError('Bot', e);
      }
    })();
  }, delayMs);
}

function rankMovesHeuristic(chess) {
  const moves = chess.moves({ verbose: true });
  if (!moves || moves.length === 0) return [];
  const centerSquares = new Set(['d4', 'd5', 'e4', 'e5', 'c3', 'c6', 'f3', 'f6', 'c4', 'c5', 'f4', 'f5']);
  const valued = moves.map((m) => {
    let score = Math.random() * 2;
    if (m.captured) score += { p: 10, n: 30, b: 30, r: 50, q: 90, k: 200 }[m.captured] || 0;
    if (m.promotion === 'q') score += 85;
    else if (m.promotion) score += 20;
    if (m.flags && m.flags.includes('e')) score += 8;
    if (centerSquares.has(m.to)) score += 4;
    if (centerSquares.has(m.from)) score -= 0.5;
    if (m.san && m.san.includes('+')) score += 12;
    if (m.san && m.san.includes('#')) score += 9999;
    if (m.flags && m.flags.includes('p')) score += 3;
    const fromPiece = m.piece || '';
    if (fromPiece === 'p' && (m.to.startsWith('3') || m.to.startsWith('6'))) score += 2;
    return { move: m, score };
  });
  valued.sort((a, b) => b.score - a.score);
  return valued;
}

function getAntiCheatStats(userId) {
  if (!userId) return null;
  const key = String(userId);
  let s = _antiCheatStats.get(key);
  if (!s) {
    s = {
      totalMoves: 0,
      topMoveHits: 0,
      top3MoveHits: 0,
      consecutiveTop: 0,
      maxConsecutiveTop: 0,
      qualitySum: 0,
      games: 0,
    };
    _antiCheatStats.set(key, s);
  }
  return s;
}

function evaluateMoveAgainstTop(chessBefore, movePlayed) {
  try {
    const ranked = rankMovesHeuristic(chessBefore);
    if (!ranked.length) return { isTop1: false, isTop3: false, quality: 0, rank: ranked.length };
    const bestScore = ranked[0].score;
    const idx = ranked.findIndex((r) => r.move.from === movePlayed.from && r.move.to === movePlayed.to && (r.move.promotion || '') === (movePlayed.promotion || ''));
    if (idx === -1) return { isTop1: false, isTop3: false, quality: 0, rank: ranked.length, topScore: bestScore };
    const moveScore = ranked[idx].score;
    const topN = ranked.slice(0, Math.min(3, ranked.length));
    const top3Score = topN.reduce((a, b) => Math.max(a, b.score), -Infinity);
    const quality = bestScore > 0 ? Math.max(0, Math.min(100, (moveScore / bestScore) * 100)) : 50;
    return {
      isTop1: idx === 0,
      isTop3: idx < 3,
      quality,
      rank: idx + 1,
      totalMoves: ranked.length,
    };
  } catch (e) {
    return { isTop1: false, isTop3: false, quality: 50, rank: 99 };
  }
}

async function checkAndApplyBanIfNeeded(userId, stats) {
  if (!userId || !mongoose) return false;
  const { BannedUser, User } = await getModels();
  if (!BannedUser) return false;

  const accuracy = stats.totalMoves > 0 ? (stats.topMoveHits / stats.totalMoves) * 100 : 0;
  const avgQuality = stats.totalMoves > 0 ? stats.qualitySum / stats.totalMoves : 0;
  const shouldFlag =
    stats.totalMoves >= 30 &&
    (stats.maxConsecutiveTop >= 18 || (accuracy >= 75 && avgQuality >= 95));

  if (!shouldFlag) return false;
  try {
    const existing = await BannedUser.findOne({ userId, severity: { $ne: 'warning' }, liftedAt: null }).sort({ createdAt: -1 });
    if (existing) return false;

    let username = null;
    try {
      if (User) {
        const u = await User.findById(userId).select('username');
        username = u?.username || null;
      }
    } catch {}

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await BannedUser.create({
      userId,
      username,
      severity: 'temp',
      flaggedBy: 'system',
      accuracyAtBan: Number(accuracy.toFixed(2)),
      consecutiveTopMoves: stats.maxConsecutiveTop,
      gamesAnalyzed: stats.games,
      expiresAt,
      reason: 'Automatic anti-cheat detection: suspiciously high move accuracy.',
    });
    log('AntiCheat', `TEMP BAN 24h user ${userId} (${username || 'n/a'}) accuracy=${accuracy.toFixed(1)}% consecutive=${stats.maxConsecutiveTop} moves=${stats.totalMoves}`);
    io.to(`user:${userId}`).emit('user:banned', {
      banned: true,
      reason: 'Automatic anti-cheat detection. Account temporarily suspended for 24 hours.',
      expiresAt,
    });
    return true;
  } catch (e) {
    logError('AntiCheat', new Error('Ban failed: ' + e.message));
    return false;
  }
}

function trackAntiCheatOnMove(userId, gm, movePlayed) {
  try {
    if (!userId || !gm || !gm.chess || !movePlayed) return;
    if (String(userId) === String(_BotUserId)) return;

    const stats = getAntiCheatStats(userId);
    if (!stats) return;

    const fenBefore = gm.data?.moves?.length
      ? (gm.data.moves[gm.data.moves.length - 1].fenBefore || null)
      : null;
    let chessBefore = gm.chess;
    if (fenBefore) {
      try { chessBefore = new Chess(fenBefore); } catch { chessBefore = gm.chess; }
    }

    const evalResult = evaluateMoveAgainstTop(chessBefore, movePlayed);
    stats.totalMoves += 1;
    stats.qualitySum += evalResult.quality;
    if (evalResult.isTop1) stats.topMoveHits += 1;
    if (evalResult.isTop3) stats.top3MoveHits += 1;
    if (evalResult.isTop1) {
      stats.consecutiveTop += 1;
      stats.maxConsecutiveTop = Math.max(stats.maxConsecutiveTop, stats.consecutiveTop);
    } else {
      stats.consecutiveTop = 0;
    }
    if (stats.totalMoves % 25 === 0) {
      const accuracy = (stats.topMoveHits / stats.totalMoves) * 100;
      log('AntiCheat', `User ${userId.slice(0, 8)} moves=${stats.totalMoves} top1=${accuracy.toFixed(1)}% consec=${stats.consecutiveTop}/${stats.maxConsecutiveTop}`);
    }
    if (stats.totalMoves >= 30) {
      checkAndApplyBanIfNeeded(userId, stats).catch(() => {});
    }
  } catch (e) {
    // silently ignore anti-cheat errors
  }
}

async function isUserCurrentlyBanned(userId) {
  if (!userId) return null;
  try {
    const { BannedUser } = await getModels();
    if (!BannedUser || typeof BannedUser.isUserBanned !== 'function') return null;
    const r = await BannedUser.isUserBanned(userId);
    return r?.banned ? r : null;
  } catch {
    return null;
  }
}

async function getModels() {
  if (_modelsReady) return { Game: _Game, User: _User, Message: _Message, Tournament: _Tournament, TournamentPlayer: _TournamentPlayer, BannedUser: _BannedUser };
  try {
    if (mongoose) {
      const gMod = await import('../models/Game.js');
      const uMod = await import('../models/User.js');
      const mMod = await import('../models/Message.js');
      const tMod = await import('../models/Tournament.js');
      const tpMod = await import('../models/TournamentPlayer.js');
      const bMod = await import('../models/BannedUser.js');
      _Game = gMod.default || gMod;
      _User = uMod.default || uMod;
      _Message = mMod.default || mMod;
      _Tournament = tMod.default || tMod;
      _TournamentPlayer = tpMod.default || tpMod;
      _BannedUser = bMod.default || bMod;
    }
  } catch (e) {
    logError('Database', new Error('Model load error: ' + e.message));
  }
  _modelsReady = true;
  return { Game: _Game, User: _User, Message: _Message, Tournament: _Tournament, TournamentPlayer: _TournamentPlayer, BannedUser: _BannedUser };
}

async function verifyJwtSocket(token) {
  try {
    const { jwtVerify } = await import('jose');
    const verified = await jwtVerify(token, AUTH_SECRET_KEY, {
      algorithms: ['HS256'],
    });
    return verified.payload || null;
  } catch (e) {
    return null;
  }
}

async function markUserOnline(userId, username) {
  if (!userId || !mongoose) return;
  const { User } = await getModels();
  if (!User) return;
  try {
    await User.updateOne(
      { _id: userId },
      { $set: { isOnline: true, lastSeen: new Date() } }
    );
    io.emit('user:presence', { userId, online: true, username });
  } catch (e) {
    logError('Database', e);
  }
}

function markUserOfflineDeferred(userId, username) {
  if (!userId) return;
  if (pendingOffline.has(userId)) clearTimeout(pendingOffline.get(userId));
  const id = setTimeout(() => {
    pendingOffline.delete(userId);
    if (!userSockets.has(userId)) {
      doMarkOffline(userId, username);
    }
  }, OFFLINE_DEBOUNCE_MS);
  pendingOffline.set(userId, id);
}

async function doMarkOffline(userId, username) {
  if (!mongoose) return;
  const { User } = await getModels();
  if (!User) return;
  try {
    await User.updateOne(
      { _id: userId },
      { $set: { isOnline: false, lastSeen: new Date() } }
    );
    io.emit('user:presence', { userId, online: false, username });
  } catch (e) {
    logError('Database', e);
  }
}

async function updateEloAndStats(gameDoc) {
  if (!gameDoc || !mongoose) return;
  if (!gameDoc.result) return;
  const { User } = await getModels();
  if (!User || !gameDoc.whitePlayer || !gameDoc.blackPlayer) return;

  const category = gameDoc.ratingCategory || getRatingCategory(gameDoc.initialTime || 300);
  try {
    const [whiteDoc, blackDoc] = await Promise.all([
      User.findById(gameDoc.whitePlayer).select(
        'rating blitzRating rapidRating classicalRating gamesPlayed gamesWon gamesDraw gamesLost username'
      ),
      User.findById(gameDoc.blackPlayer).select(
        'rating blitzRating rapidRating classicalRating gamesPlayed gamesWon gamesDraw gamesLost username'
      ),
    ]);
    if (!whiteDoc || !blackDoc) return;

    const wRating = whiteDoc[category] ?? 1200;
    const bRating = blackDoc[category] ?? 1200;
    let wNew, bNew;
    let wResult, bResult;

    if (gameDoc.result === 'white') {
      const r = calculateEloRating(wRating, bRating, false, 32);
      wNew = r.winner;
      bNew = r.loser;
      wResult = 'win';
      bResult = 'loss';
    } else if (gameDoc.result === 'black') {
      const r = calculateEloRating(bRating, wRating, false, 32);
      bNew = r.winner;
      wNew = r.loser;
      bResult = 'win';
      wResult = 'loss';
    } else {
      const r = calculateEloRating(wRating, bRating, true, 32);
      wNew = r.winner;
      bNew = r.loser;
      wResult = 'draw';
      bResult = 'draw';
    }

    function nextRating(doc, resultLabel, newCatRating) {
      const d = doc.toObject ? doc.toObject() : { ...doc };
      d.gamesPlayed = (d.gamesPlayed || 0) + 1;
      if (resultLabel === 'win') d.gamesWon = (d.gamesWon || 0) + 1;
      else if (resultLabel === 'draw') d.gamesDraw = (d.gamesDraw || 0) + 1;
      else if (resultLabel === 'loss') d.gamesLost = (d.gamesLost || 0) + 1;
      d[category] = newCatRating;
      const blitz = d.blitzRating ?? 1200;
      const rapid = d.rapidRating ?? 1200;
      const classical = d.classicalRating ?? 1200;
      d.rating = Math.round((blitz + rapid + classical) / 3);
      return d;
    }

    const wNext = nextRating(whiteDoc, wResult, wNew);
    const bNext = nextRating(blackDoc, bResult, bNew);

    await User.bulkWrite([
      {
        updateOne: {
          filter: { _id: whiteDoc._id },
          update: {
            $set: {
              rating: wNext.rating,
              [category]: wNext[category],
            },
            $inc: {
              gamesPlayed: 1,
              gamesWon: wResult === 'win' ? 1 : 0,
              gamesDraw: wResult === 'draw' ? 1 : 0,
              gamesLost: wResult === 'loss' ? 1 : 0,
            },
          },
        },
      },
      {
        updateOne: {
          filter: { _id: blackDoc._id },
          update: {
            $set: {
              rating: bNext.rating,
              [category]: bNext[category],
            },
            $inc: {
              gamesPlayed: 1,
              gamesWon: bResult === 'win' ? 1 : 0,
              gamesDraw: bResult === 'draw' ? 1 : 0,
              gamesLost: bResult === 'loss' ? 1 : 0,
            },
          },
        },
      },
    ]);

    gameDoc.ratingDeltaWhite = wNew - wRating;
    gameDoc.ratingDeltaBlack = bNew - bRating;

    log(
      'Rating',
      `Game ${gameDoc.gameId}: ${whiteDoc.username} ${wNew >= wRating ? '+' : ''}${wNew - wRating} (${wNext[category]}), ${blackDoc.username} ${bNew >= bRating ? '+' : ''}${bNew - bRating} (${bNext[category]}), category=${category}`
    );
  } catch (e) {
    logError('Rating', e);
  }
  if (gameDoc.tournamentId) {
    await updateTournamentPlayersOnGameFinish(gameDoc).catch(e => logError('Tournament', e));
  }
}

async function updateTournamentPlayersOnGameFinish(gameDoc) {
  if (!mongoose || !gameDoc.tournamentId) return;
  const { Tournament, TournamentPlayer } = await getModels();
  if (!Tournament || !TournamentPlayer) return;
  try {
    const tid = typeof gameDoc.tournamentId === 'string' ? gameDoc.tournamentId : gameDoc.tournamentId.toString();
    const t = await Tournament.findById(tid);
    if (!t) return;
    const wpId = gameDoc.whitePlayer ? String(gameDoc.whitePlayer) : null;
    const bpId = gameDoc.blackPlayer ? String(gameDoc.blackPlayer) : null;
    if (!wpId || !bpId) return;

    let wScore = 0, bScore = 0;
    let wWin = 0, bWin = 0, wLoss = 0, bLoss = 0, wDraw = 0, bDraw = 0;
    const winPts = Number(t.scoring?.win);
    const drawPts = Number(t.scoring?.draw);
    const lossPts = Number(t.scoring?.loss);
    const ptsWin = Number.isFinite(winPts) ? winPts : 2;
    const ptsDraw = Number.isFinite(drawPts) ? drawPts : 1;
    const ptsLoss = Number.isFinite(lossPts) ? lossPts : 0;
    if (gameDoc.result === 'white') { wScore = ptsWin; bScore = ptsLoss; wWin = 1; bLoss = 1; }
    else if (gameDoc.result === 'black') { bScore = ptsWin; wScore = ptsLoss; bWin = 1; wLoss = 1; }
    else if (gameDoc.result === 'draw') { wScore = ptsDraw; bScore = ptsDraw; wDraw = 1; bDraw = 1; }

    const ops = [];
    if (wScore !== 0 || wWin || wLoss || wDraw) {
      ops.push({
        updateOne: {
          filter: { tournamentId: t._id, userId: wpId },
          update: {
            $inc: { score: wScore, wins: wWin, losses: wLoss, draws: wDraw, gamesPlayed: 1 },
            $set: { status: 'active' },
          },
        },
      });
    }
    if (bScore !== 0 || bWin || bLoss || bDraw) {
      ops.push({
        updateOne: {
          filter: { tournamentId: t._id, userId: bpId },
          update: {
            $inc: { score: bScore, wins: bWin, losses: bLoss, draws: bDraw, gamesPlayed: 1 },
            $set: { status: 'active' },
          },
        },
      });
    }
    if (ops.length) await TournamentPlayer.bulkWrite(ops);

    await broadcastTournamentStandings(t._id);
    log('Tournament', `Game ${gameDoc.gameId} scores updated for tournament ${t._id}`);
  } catch (e) {
    logError('Tournament', e);
  }
}

async function broadcastTournamentStandings(tournamentId) {
  if (!mongoose) return;
  const { TournamentPlayer } = await getModels();
  if (!TournamentPlayer) return;
  try {
    const players = await TournamentPlayer.find({ tournamentId })
      .sort({ score: -1, buchholz: -1, sonnebornBerger: -1, rating: -1 })
      .select('userId username rating score wins losses draws gamesPlayed buchholz status')
      .lean();
    io.to(`tournament:${tournamentId}`).emit('tournament:update', {
      tournamentId,
      players: players.map((p, i) => ({ ...p, rank: i + 1 })),
    });
  } catch (e) {
    logError('Tournament', e);
  }
}

async function createTournamentGame(tournamentDoc, a, b) {
  if (!mongoose) return null;
  const { Game, User } = await getModels();
  if (!Game) return null;
  try {
    const t = tournamentDoc;
    const it = t.timeControl?.initialTime || 300;
    const inc = t.timeControl?.increment || 0;
    const category = getRatingCategory(it);
    let whiteId = a.userId, blackId = b.userId;
    if (Math.random() < 0.5) { whiteId = b.userId; blackId = a.userId; }
    const [wD, bD] = User
      ? await Promise.all([
          User.findById(whiteId).select('username rating ' + category),
          User.findById(blackId).select('username rating ' + category),
        ])
      : [null, null];
    const gameId = 'g_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const payload = {
      gameId,
      whitePlayer: whiteId,
      blackPlayer: blackId,
      whiteUsername: wD?.username || a.username || 'P1',
      blackUsername: bD?.username || b.username || 'P2',
      whiteRating: wD?.[category] || wD?.rating || a.rating || 1200,
      blackRating: bD?.[category] || bD?.rating || b.rating || 1200,
      ratingCategory: category,
      initialTime: it,
      increment: inc,
      whiteTime: it,
      blackTime: it,
      turn: 'w',
      status: 'playing',
      result: null,
      termination: null,
      isPrivate: false,
      moves: [],
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      createdAt: new Date(),
      startedAt: new Date(),
      tournamentId: t._id.toString(),
    };
    if (Game) {
      try { await Game.create(payload); } catch (e) { logError('Database', e); }
    }
    const gm = new GameManager(payload);
    gm.lastMoveAt = new Date();
    gameManagers.set(gameId, gm);
    const aSocket = userSockets.get(String(a.userId));
    const bSocket = userSockets.get(String(b.userId));
    const aSide = String(whiteId) === String(a.userId) ? 'white' : 'black';
    const bSide = String(whiteId) === String(b.userId) ? 'white' : 'black';
    if (aSocket) io.to(`socket:${aSocket}`).emit('game:matched', { gameId, side: aSide });
    if (bSocket) io.to(`socket:${bSocket}`).emit('game:matched', { gameId, side: bSide });
    io.to(`tournament:${t._id}`).emit('tournament:pairings', {
      tournamentId: t._id,
      pairing: { gameId, white: { id: whiteId, username: payload.whiteUsername }, black: { id: blackId, username: payload.blackUsername }, status: 'playing' },
    });
    io.emit('lobby:update', { gameId, status: 'playing' });
    log('Tournament', `Pairing for ${t.name}: ${payload.whiteUsername} vs ${payload.blackUsername} → ${gameId}`);
    return payload;
  } catch (e) {
    logError('Tournament', e);
    return null;
  }
}

async function isUserInLiveTournamentGame(tournamentId, userId) {
  if (!mongoose) return false;
  const { Game } = await getModels();
  if (!Game) return false;
  try {
    const tid = typeof tournamentId === 'string' ? tournamentId : tournamentId.toString();
    const uid = typeof userId === 'string' ? userId : userId.toString();
    const live = await Game.exists({
      tournamentId: tid,
      status: 'playing',
      $or: [{ whitePlayer: uid }, { blackPlayer: uid }],
    });
    return !!live;
  } catch { return false; }
}

async function tournamentArenaPairer() {
  if (!mongoose) return;
  const { Tournament, TournamentPlayer } = await getModels();
  if (!Tournament || !TournamentPlayer) return;
  try {
    const liveTournaments = await Tournament.find({ status: 'live', type: 'arena' }).lean();
    for (const t of liveTournaments) {
      try {
        const players = await TournamentPlayer.find({ tournamentId: t._id, status: { $in: ['registered', 'active'] } })
          .sort({ score: -1, rating: -1 })
          .select('userId username rating score wins losses draws gamesPlayed status')
          .lean();
        if (!players || players.length < 2) continue;

        const checked = new Set();
        for (let i = 0; i < players.length - 1; i++) {
          const a = players[i];
          if (checked.has(String(a.userId))) continue;
          for (let j = i + 1; j < players.length; j++) {
            const b = players[j];
            if (checked.has(String(b.userId))) continue;
            const aLive = await isUserInLiveTournamentGame(t._id, a.userId);
            if (aLive) { checked.add(String(a.userId)); break; }
            const bLive = await isUserInLiveTournamentGame(t._id, b.userId);
            if (bLive) { checked.add(String(b.userId)); continue; }
            checked.add(String(a.userId));
            checked.add(String(b.userId));
            await createTournamentGame(t, a, b);
            break;
          }
        }
      } catch (e) { logError('TournamentPairer', e); }
    }
  } catch (e) { logError('TournamentPairer', e); }
}

async function checkTournamentStartFinish() {
  if (!mongoose) return;
  const { Tournament, TournamentPlayer } = await getModels();
  if (!Tournament || !TournamentPlayer) return;
  try {
    const now = Date.now();
    const registering = await Tournament.find({ status: 'registration' }).lean();
    for (const t of registering) {
      try {
        const startTs = t.startAt ? new Date(t.startAt).getTime() : Infinity;
        const count = await TournamentPlayer.countDocuments({ tournamentId: t._id });
        if (count >= (t.maxPlayers || 2) && count >= 2) {
          await Tournament.findByIdAndUpdate(t._id, { $set: { status: 'live', currentPlayers: count } });
          io.to(`tournament:${t._id}`).emit('tournament:started', { tournamentId: t._id });
          log('Tournament', `Tournament ${t.name} started (maxPlayers reached)`);
          try {
            const players = await TournamentPlayer.find({ tournamentId: t._id }).select('userId').lean();
            for (const p of players) {
              io.to(`user:${p.userId}`).emit('notify:tournament_started', { tournamentId: t._id, name: t.name });
            }
          } catch {}
        } else if (now >= startTs && count >= 2) {
          await Tournament.findByIdAndUpdate(t._id, { $set: { status: 'live', currentPlayers: count } });
          io.to(`tournament:${t._id}`).emit('tournament:started', { tournamentId: t._id });
          log('Tournament', `Tournament ${t.name} started (startAt reached)`);
          try {
            const players = await TournamentPlayer.find({ tournamentId: t._id }).select('userId').lean();
            for (const p of players) {
              io.to(`user:${p.userId}`).emit('notify:tournament_started', { tournamentId: t._id, name: t.name });
            }
          } catch {}
        }
      } catch (e) { logError('Tournament', e); }
    }

    const live = await Tournament.find({ status: 'live' }).lean();
    for (const t of live) {
      try {
        const startTs = t.startAt ? new Date(t.startAt).getTime() : now;
        const duration = t.durationMs || (1000 * 60 * 60 * 2);
        if (now - startTs >= duration) {
          const players = await TournamentPlayer.find({ tournamentId: t._id })
            .sort({ score: -1, buchholz: -1, sonnebornBerger: -1, rating: -1 })
            .select('userId')
            .limit(3)
            .lean();
          const winners = players.map(p => p.userId);
          await Tournament.findByIdAndUpdate(t._id, {
            $set: { status: 'finished', winners, currentPlayers: await TournamentPlayer.countDocuments({ tournamentId: t._id }) },
          });
          io.to(`tournament:${t._id}`).emit('tournament:finished', { tournamentId: t._id, winners });
          log('Tournament', `Tournament ${t.name} finished with ${winners.length} winners`);
        }
      } catch (e) { logError('Tournament', e); }
    }
  } catch (e) { logError('Tournament', e); }
}

class GameManager {
  constructor(gameData) {
    this.data = gameData;
    this.chess = new Chess(this.data.fen);
    this.lastMoveAt = this.data.lastMoveAt ? new Date(this.data.lastMoveAt) : new Date();
    this._usernameCache = new Map();
  }

  static async restoreFromMongo(gameId) {
    if (!mongoose) return null;
    const { Game } = await getModels();
    if (!Game) return null;
    try {
      const doc = await Game.findOne({ gameId });
      if (!doc) return null;
      const gm = new GameManager(doc.toObject());
      try {
        gm.chess = new Chess(doc.fen);
      } catch (e) {
        gm.chess = new Chess();
      }
      gameManagers.set(gameId, gm);
      log('Game', `Restored game ${gameId} from DB (moves=${doc.moves?.length || 0})`);
      return gm;
    } catch (e) {
      logError('Database', e);
      return null;
    }
  }

  consumeTime() {
    if (this.data.status !== 'playing') return;
    const now = Date.now();
    const elapsed = Math.max(
      0,
      Math.floor((now - (this.lastMoveAt ? this.lastMoveAt.getTime() : now)) / 1000)
    );
    if (elapsed <= 0) return;
    if (this.data.turn === 'w') {
      this.data.whiteTime = Math.max(0, this.data.whiteTime - elapsed);
    } else {
      this.data.blackTime = Math.max(0, this.data.blackTime - elapsed);
    }
    this.lastMoveAt = new Date(now);
  }

  makeMove(playerId, from, to, promotion) {
    if (this.data.status !== 'playing') {
      return { ok: false, error: 'Game not in progress' };
    }
    const side =
      playerId && String(this.data.whitePlayer) === String(playerId)
        ? 'w'
        : String(this.data.blackPlayer) === String(playerId)
          ? 'b'
          : null;
    if (!side) return { ok: false, error: 'Not a participant' };
    if (side !== this.data.turn) return { ok: false, error: 'Not your turn' };

    this.consumeTime();
    const loserSide =
      this.data.turn === 'w'
        ? this.data.whiteTime <= 0
          ? 'w'
          : null
        : this.data.blackTime <= 0
          ? 'b'
          : null;
    if (loserSide) return this.finishByTimeout(loserSide);

    const fenBefore = this.chess.fen();
    try {
      const moveOpts = { from, to };
      let promo = null;
      if (promotion != null && promotion !== '') {
        const p = String(promotion).toLowerCase().replace(/[^qrbn]/g, '').slice(0, 1);
        promo = ['q', 'r', 'b', 'n'].includes(p) ? p : 'q';
      } else {
        const piece = this.chess.get(from);
        if (piece?.type === 'p' && (to?.[1] === '8' || to?.[1] === '1')) {
          promo = 'q';
        }
      }
      if (promo) moveOpts.promotion = promo;
      const move = this.chess.move(moveOpts);
      if (!move) return { ok: false, error: 'Invalid move' };

      const elapsedPerMove = Math.max(
        0,
        Math.floor(
          (Date.now() -
            (this.data.lastMoveAt ? new Date(this.data.lastMoveAt).getTime() : Date.now())) /
            1000
        )
      );
      const timeSpent = Math.min(elapsedPerMove, (this.data.initialTime || 300) * 2);

      if (side === 'w') {
        this.data.whiteTime = Math.min(
          this.data.initialTime,
          (this.data.whiteTime || 0) + (this.data.increment || 0)
        );
      } else {
        this.data.blackTime = Math.min(
          this.data.initialTime,
          (this.data.blackTime || 0) + (this.data.increment || 0)
        );
      }

      const moveEntry = {
        from: move.from,
        to: move.to,
        san: move.san,
        lan: `${move.from}${move.to}${move.promotion || ''}`,
        piece: move.piece,
        captured: move.captured,
        promotion: move.promotion,
        flags: move.flags,
        timeSpent,
        whiteTime: this.data.whiteTime,
        blackTime: this.data.blackTime,
        fenBefore,
        fenAfter: this.chess.fen(),
      };
      if (!this.data.moves) this.data.moves = [];
      this.data.moves.push(moveEntry);
      this.data.fen = this.chess.fen();
      this.data.turn = this.chess.turn();
      this.lastMoveAt = new Date();

      if (this.chess.isCheckmate()) {
        return this.finish({
          result: side === 'w' ? 'white' : 'black',
          termination: 'checkmate',
          move,
        });
      }
      if (this.chess.isStalemate()) {
        return this.finish({ result: 'draw', termination: 'stalemate', move });
      }
      if (this.chess.isThreefoldRepetition()) {
        return this.finish({ result: 'draw', termination: 'threefold_repetition', move });
      }
      if (this.chess.isInsufficientMaterial()) {
        return this.finish({ result: 'draw', termination: 'insufficient_material', move });
      }
      if (this.chess.isDraw()) {
        return this.finish({ result: 'draw', termination: 'draw_agreement', move });
      }

      return { ok: true, move, state: this.getState() };
    } catch (err) {
      logError('Game', err);
      return { ok: false, error: 'Invalid move' };
    }
  }

  finishByTimeout(loserSide) {
    const result = loserSide === 'w' ? 'black' : 'white';
    return this.finish({ result, termination: 'timeout' });
  }

  finish({ result, termination }) {
    this.data.status = 'finished';
    this.data.result = result;
    this.data.termination = termination;
    this.data.finishedAt = new Date();
    const state = this.getState();
    (async () => {
      try {
        await this.save();
        await updateEloAndStats(this.data);
        io.emit('lobby:update', { gameId: this.data.gameId, status: 'finished' });
      } catch (e) {
        logError('Game', e);
      }
    })();
    return { ok: true, finished: true, state };
  }

  resign(playerId) {
    const side =
      String(this.data.whitePlayer) === String(playerId)
        ? 'w'
        : String(this.data.blackPlayer) === String(playerId)
          ? 'b'
          : null;
    if (!side || this.data.status !== 'playing')
      return { ok: false, error: 'Cannot resign' };
    return this.finish({
      result: side === 'w' ? 'black' : 'white',
      termination: 'resignation',
    });
  }

  getState() {
    return {
      gameId: this.data.gameId,
      fen: this.chess.fen(),
      turn: this.data.turn,
      whiteTime: this.data.whiteTime,
      blackTime: this.data.blackTime,
      status: this.data.status,
      result: this.data.result,
      termination: this.data.termination,
      moves: (this.data.moves || []).map((m) => ({
        san: m.san,
        lan: m.lan,
        timeSpent: m.timeSpent,
        fenAfter: m.fenAfter,
        from: m.from,
        to: m.to,
        promotion: m.promotion,
      })),
      ratingCategory: this.data.ratingCategory,
      initialTime: this.data.initialTime,
      increment: this.data.increment,
      whitePlayerId: mongoId(this.data.whitePlayer),
      blackPlayerId: mongoId(this.data.blackPlayer),
      whiteUsername: this.data.whiteUsername,
      blackUsername: this.data.blackUsername,
      whiteRating: this.data.whiteRating,
      blackRating: this.data.blackRating,
      isPrivate: !!this.data.isPrivate,
      startedAt: this.data.startedAt,
      finishedAt: this.data.finishedAt,
      lastMove:
        this.data.moves && this.data.moves.length
          ? {
              from: this.data.moves[this.data.moves.length - 1].from,
              to: this.data.moves[this.data.moves.length - 1].to,
              san: this.data.moves[this.data.moves.length - 1].san,
            }
          : null,
    };
  }

  async save() {
    if (!mongoose) return;
    const { Game } = await getModels();
    if (!Game) return;
    const gameId = this.data.gameId;
    if (!gameId) return;
    try {
      const setDoc = {};
      const fields = [
        'whitePlayer',
        'blackPlayer',
        'whiteUsername',
        'blackUsername',
        'whiteRating',
        'blackRating',
        'ratingCategory',
        'initialTime',
        'increment',
        'whiteTime',
        'blackTime',
        'lastMoveAt',
        'fen',
        'turn',
        'moves',
        'status',
        'result',
        'termination',
        'isPrivate',
        'inviteCode',
        'drawOfferedBy',
        'rematchOfferedBy',
        'startedAt',
        'finishedAt',
        'ratingDeltaWhite',
        'ratingDeltaBlack',
      ];
      for (const k of fields) if (this.data[k] !== undefined) setDoc[k] = this.data[k];
      await Game.findOneAndUpdate({ gameId }, { $set: setDoc }, { upsert: false, new: false });
    } catch (e) {
      logError('Database', e);
    }
  }
}

async function syncAndBroadcastGame(gameId) {
  if (!gameId) return;
  try {
    let gm = gameManagers.get(gameId) || (await GameManager.restoreFromMongo(gameId));
    const { Game } = await getModels();
    if (Game) {
      const doc = await Game.findOne({ gameId });
      if (doc && gm) applyDocToManager(gm, doc);
    }
    if (gm) emitGameRoom(gameId, gm);
  } catch (e) {
    logError('GameSync', e);
  }
}

async function connectMongo() {
  if (!mongoose) return false;
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) return false;
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    log('Database', 'Connected to MongoDB');
    await getModels();
    return true;
  } catch (e) {
    logError('Database', e);
    return false;
  }
}

function canChat(userId) {
  const now = Date.now();
  let rec = chatRateLimit.get(userId);
  if (!rec) {
    rec = { first: now, count: 1, last: now };
    chatRateLimit.set(userId, rec);
    return true;
  }
  if (now - rec.first > 60_000) {
    rec.first = now;
    rec.count = 1;
    rec.last = now;
    return true;
  }
  if (now - rec.last < RATE_LIMIT_MS) return false;
  if (rec.count >= MAX_MESSAGES_PER_MINUTE) return false;
  rec.count++;
  rec.last = now;
  return true;
}

function canMoveNow(userId, gameId) {
  const now = Date.now();
  const key = `${userId}__${gameId}`;
  let rec = moveRateLimit.get(key);
  if (!rec) {
    rec = { last: 0, count: 0, windowStart: now };
  }
  if (now - rec.windowStart >= 1000) {
    rec.windowStart = now;
    rec.count = 0;
  }
  if (now - rec.last < 200) return false;
  if (rec.count >= MAX_MOVES_PER_SECOND) return false;
  rec.count++;
  rec.last = now;
  moveRateLimit.set(key, rec);
  return true;
}

function tickAllGames() {
  for (const [gameId, gm] of gameManagers.entries()) {
    if (gm.data.status !== 'playing') continue;
    try {
      const prevW = gm.data.whiteTime;
      const prevB = gm.data.blackTime;
      gm.consumeTime();
      if (gm.data.whiteTime <= 0) {
        const fin = gm.finishByTimeout('w');
        io.to(`game:${gameId}`).emit('game:state', fin.state);
        io.to(`game:${gameId}`).emit('game:clock', {
          whiteTime: 0,
          blackTime: gm.data.blackTime,
          turn: gm.data.turn,
        });
        io.to(`game:${gameId}`).emit('game:finished', {
          result: fin.state.result,
          termination: fin.state.termination,
        });
        log('Game', `Game ${gameId} finished: ${fin.state.result} (timeout)`);
        gm.save().catch((e) => logError('Game', e));
        continue;
      }
      if (gm.data.blackTime <= 0) {
        const fin = gm.finishByTimeout('b');
        io.to(`game:${gameId}`).emit('game:state', fin.state);
        io.to(`game:${gameId}`).emit('game:clock', {
          whiteTime: gm.data.whiteTime,
          blackTime: 0,
          turn: gm.data.turn,
        });
        io.to(`game:${gameId}`).emit('game:finished', {
          result: fin.state.result,
          termination: fin.state.termination,
        });
        log('Game', `Game ${gameId} finished: ${fin.state.result} (timeout)`);
        gm.save().catch((e) => logError('Game', e));
        continue;
      }
      if (prevW !== gm.data.whiteTime || prevB !== gm.data.blackTime) {
        io.to(`game:${gameId}`).emit('game:clock', {
          whiteTime: gm.data.whiteTime,
          blackTime: gm.data.blackTime,
          turn: gm.data.turn,
        });
      }
    } catch (e) {
      logError('Tick', e);
    }
  }
}

function qmKey(initialTime, increment, category) {
  return `${initialTime}|${increment}|${category}`;
}

function attemptQuickMatch() {
  for (const [key, queue] of quickMatchQueues.entries()) {
    if (queue.length < 2) continue;
    for (let i = 0; i < queue.length - 1; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const a = queue[i];
        const b = queue[j];
        if (a.color && b.color && a.color === b.color) continue;
        const ratingDiff = Math.abs(a.rating - b.rating);
        const waiting = Math.max(Date.now() - a.enqueuedAt, Date.now() - b.enqueuedAt);
        const threshold = waiting > 30000 ? 1000 : 300;
        if (ratingDiff > threshold) continue;
        queue.splice(j, 1);
        queue.splice(i, 1);
        void startQuickMatchedGame(key, a, b);
        return attemptQuickMatch();
      }
    }
  }
}

async function startQuickMatchedGame(key, a, b) {
  try {
    const [initialTime, increment, category] = key.split('|');
    const it = parseInt(initialTime, 10);
    const inc = parseInt(increment, 10);
    let white = a;
    let black = b;
    if (a.color === 'black') {
      white = b;
      black = a;
    } else if (!a.color && !b.color && Math.random() < 0.5) {
      white = b;
      black = a;
    } else if (b.color === 'white') {
      white = b;
      black = a;
    }

    const { User, Game } = mongoose ? await getModels() : { User: null, Game: null };
    const [wDoc, bDoc] = User
      ? await Promise.all([
          User.findById(white.userId).select('username avatar rating'),
          User.findById(black.userId).select('username avatar rating'),
        ])
      : [null, null];

    const gameId = 'g_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const payload = {
      gameId,
      whitePlayer: white.userId,
      blackPlayer: black.userId,
      whiteUsername: wDoc?.username || 'PlayerW',
      blackUsername: bDoc?.username || 'PlayerB',
      whiteRating: wDoc?.[category] || wDoc?.rating || 1200,
      blackRating: bDoc?.[category] || bDoc?.rating || 1200,
      ratingCategory: category,
      initialTime: it,
      increment: inc,
      whiteTime: it,
      blackTime: it,
      turn: 'w',
      status: 'playing',
      result: null,
      termination: null,
      isPrivate: false,
      moves: [],
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      createdAt: new Date(),
      startedAt: new Date(),
    };
    if (Game) {
      try {
        await Game.create(payload);
      } catch (e) {
        logError('Database', e);
      }
    }
    const gm = new GameManager(payload);
    gm.lastMoveAt = new Date();
    gameManagers.set(gameId, gm);
    io.to(`socket:${white.socketId}`).emit('quick_match:matched', { gameId, side: 'white' });
    io.to(`socket:${black.socketId}`).emit('quick_match:matched', { gameId, side: 'black' });
    io.to(`user:${white.userId}`).emit('notify:game_started', { gameId, opponent: black.username || null, side: 'white' });
    io.to(`user:${black.userId}`).emit('notify:game_started', { gameId, opponent: white.username || null, side: 'black' });
    log('QuickMatch', `Matched ${white.username || white.userId} vs ${black.username || black.userId} → ${gameId}`);
    io.emit('lobby:update', { gameId, status: 'playing' });
  } catch (e) {
    logError('QuickMatch', e);
  }
}

io.on('connection', async (socket) => {
  const cookieHeader =
    socket.handshake.headers?.cookie ||
    (socket.handshake.auth ? socket.handshake.auth.cookie : null) ||
    '';
  let parsedCookies = {};
  try {
    parsedCookies = cookie.parse(String(cookieHeader || ''));
  } catch {
    parsedCookies = {};
  }
  const rawToken =
    parsedCookies[AUTH_COOKIE_NAME] ||
    socket.handshake.auth?.token ||
    socket.handshake.headers?.['x-auth-token'] ||
    null;
  let userId = null;
  let username = socket.handshake.auth?.username || null;

  if (rawToken) {
    const payload = await verifyJwtSocket(rawToken);
    if (payload && payload.userId) {
      userId = payload.userId;
      if (mongoose) {
        try {
          const { User } = await getModels();
          if (User) {
            const u = await User.findById(userId).select('username isOnline rating');
            if (u) {
              username = u.username;
              if (socket.handshake.auth) socket.handshake.auth.username = username;
            } else {
              userId = null;
            }
          }
        } catch (e) {
          logError('Auth', e);
        }
      }
    }
  }

  if (!userId && rawToken) {
    log('Socket', `Rejected connection: invalid JWT socket=${socket.id}`);
    socket.disconnect(true);
    return;
  }

  log('Socket', `Client connected: ${socket.id}${userId ? ` (user ${userId} ${username || ''})` : ' (guest)'}`);

  socket.join(`socket:${socket.id}`);

  if (userId) {
    if (pendingOffline.has(userId)) {
      clearTimeout(pendingOffline.get(userId));
      pendingOffline.delete(userId);
    }
    userSockets.set(userId, socket.id);
    socket.join(`user:${userId}`);
    await markUserOnline(userId, username);
    try {
      const { BannedUser } = await getModels();
      if (BannedUser && typeof BannedUser.isUserBanned === 'function') {
        const banRes = await BannedUser.isUserBanned(userId);
        if (banRes?.banned) {
          socket.emit('user:banned', {
            banned: true,
            reason: banRes.reason,
            severity: banRes.severity,
            expiresAt: banRes.expiresAt,
            flaggedBy: banRes.flaggedBy,
          });
          log('Auth', `Connected banned user ${userId.slice(0, 8)} notified.`);
        }
      }
    } catch {}
  }

  socket.on('disconnect', (reason) => {
    log('Socket', `${socket.id} disconnected: ${reason}${userId ? ` user=${userId}` : ''}`);
    if (userId && userSockets.get(userId) === socket.id) {
      userSockets.delete(userId);
      markUserOfflineDeferred(userId, username);
    }
  });

  socket.on('quick_match:enqueue', async ({ initialTime, increment, color, ratingMin, ratingMax }) => {
    if (!userId) return;
    const ban = await isUserCurrentlyBanned(userId);
    if (ban) {
      socket.emit('game:error', { code: 'BANNED', message: ban.reason || 'Your account is suspended.' });
      return;
    }
    const it = parseInt(initialTime, 10);
    const inc = parseInt(increment || 0, 10);
    if (!Number.isFinite(it) || it < 30 || it > 7200) return;
    if (!Number.isFinite(inc) || inc < 0 || inc > 60) return;
    const category = getRatingCategory(it);
    for (const [, q] of quickMatchQueues) {
      const idx = q.findIndex((x) => x.socketId === socket.id || x.userId === userId);
      if (idx >= 0) q.splice(idx, 1);
    }
    const key = qmKey(it, inc, category);
    if (!quickMatchQueues.has(key)) quickMatchQueues.set(key, []);
    let rating = 1200;
    if (mongoose) {
      try {
        const { User } = await getModels();
        if (User) {
          const u = await User.findById(userId).select(`${category} rating`);
          if (u) rating = u[category] || u.rating || 1200;
        }
      } catch {}
    }
    quickMatchQueues.get(key).push({
      userId,
      socketId: socket.id,
      username,
      color: color === 'white' || color === 'black' ? color : null,
      rating,
      ratingMin: ratingMin ? Number(ratingMin) : null,
      ratingMax: ratingMax ? Number(ratingMax) : null,
      enqueuedAt: Date.now(),
    });
    log('QuickMatch', `Enqueued ${username || userId} → ${key} rating=${rating}`);
    attemptQuickMatch();
  });

  socket.on('quick_match:dequeue', () => {
    for (const [, q] of quickMatchQueues) {
      const idx = q.findIndex((x) => x.socketId === socket.id);
      if (idx >= 0) q.splice(idx, 1);
    }
  });

  socket.on('game:invite_user', async ({ toUsername, gameId }, ack) => {
    try {
      if (!userId || !username) return ack?.({ ok: false, error: 'Authentication required' });
      if (!toUsername || typeof toUsername !== 'string') return ack?.({ ok: false, error: 'Username invalid' });
      if (!gameId || typeof gameId !== 'string') return ack?.({ ok: false, error: 'Game ID invalid' });
      const ban = await isUserCurrentlyBanned(userId);
      if (ban) return ack?.({ ok: false, error: ban.reason || 'Cont suspendat' });
      const { User } = await getModels();
      if (!User) return ack?.({ ok: false, error: 'DB unavailable' });
      const target = await User.findOne({ username: String(toUsername).trim() }).select('_id username');
      if (!target) return ack?.({ ok: false, error: 'User not found' });
      if (String(target._id) === String(userId)) return ack?.({ ok: false, error: 'You cannot invite yourself' });
      io.to(`user:${target._id}`).emit('notify:game_invite', {
        gameId,
        from: username,
        fromUserId: userId,
        createdAt: Date.now(),
      });
      const targetSocket = userSockets.get(String(target._id));
      if (targetSocket) {
        log('Game', `${username} (${userId.slice(0,8)}) invited ${target.username} (${target._id.slice(0,8)}) to game ${gameId}`);
        return ack?.({ ok: true, online: true });
      } else {
        return ack?.({ ok: true, online: false, message: 'User is offline, but the invite was sent.' });
      }
    } catch (e) {
      logError('Game Invite', e);
      return ack?.({ ok: false, error: 'Could not send invite' });
    }
  });

  socket.on('game:join', async ({ gameId }, ack) => {
    try {
      if (!gameId || typeof gameId !== 'string') {
        return ack?.({ ok: false, error: 'Invalid game id' });
      }
      if (userId) {
        const ban = await isUserCurrentlyBanned(userId);
        if (ban) {
          socket.emit('game:error', { code: 'BANNED', message: ban.reason || 'Your account is suspended.' });
          socket.leave(`game:${gameId}`);
          return ack?.({ ok: false, error: ban.reason || 'Cont suspendat' });
        }
      }
      log('Game', `Socket ${socket.id} joining game ${gameId}`);
      socket.join(`game:${gameId}`);

      let gm = gameManagers.get(gameId);
      if (!gm) gm = await GameManager.restoreFromMongo(gameId);
      if (!gm) {
        const fake = {
          gameId,
          whitePlayer: null,
          blackPlayer: null,
          initialTime: 300,
          increment: 3,
          whiteTime: 300,
          blackTime: 300,
          turn: 'w',
          status: 'waiting',
          result: null,
          termination: null,
          moves: [],
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        };
        gm = new GameManager(fake);
        gameManagers.set(gameId, gm);
      }

      if (mongoose) {
        try {
          const { Game, User } = await getModels();
          if (Game) {
            const doc = await Game.findOne({ gameId });
            if (doc) {
              applyDocToManager(gm, doc);
              if (userId) {
                const whiteId = mongoId(doc.whitePlayer);
                const blackId = mongoId(doc.blackPlayer);
                const alreadySeated = whiteId === String(userId) || blackId === String(userId);
                if (!alreadySeated && (doc.status === 'waiting' || !doc.startedAt)) {
                  let seated = false;
                  if (!whiteId && blackId !== String(userId)) {
                    doc.whitePlayer = userId;
                    gm.data.whitePlayer = userId;
                    seated = true;
                    if (User) {
                      const u = await User.findById(userId).select('username rating blitzRating rapidRating classicalRating');
                      doc.whiteUsername = u?.username || username || null;
                      doc.whiteRating = u?.[doc.ratingCategory] || u?.rating || 1200;
                      gm.data.whiteUsername = doc.whiteUsername;
                      gm.data.whiteRating = doc.whiteRating;
                    }
                  } else if (!blackId && whiteId !== String(userId)) {
                    doc.blackPlayer = userId;
                    gm.data.blackPlayer = userId;
                    seated = true;
                    if (User) {
                      const u = await User.findById(userId).select('username rating blitzRating rapidRating classicalRating');
                      doc.blackUsername = u?.username || username || null;
                      doc.blackRating = u?.[doc.ratingCategory] || u?.rating || 1200;
                      gm.data.blackUsername = doc.blackUsername;
                      gm.data.blackRating = doc.blackRating;
                    }
                  }
                  if (seated) log('Game', `Seated ${username || userId} in ${gameId}`);
                }
                if (mongoId(doc.whitePlayer) && mongoId(doc.blackPlayer) && doc.status === 'waiting') {
                  doc.status = 'playing';
                  doc.startedAt = new Date();
                  gm.data.status = 'playing';
                  gm.data.startedAt = doc.startedAt;
                  gm.lastMoveAt = new Date();
                  io.emit('lobby:update', { gameId, status: 'playing' });
                  log('Game', `Game ${gameId} started: ${doc.whiteUsername} vs ${doc.blackUsername}`);
                }
                await doc.save();
                applyDocToManager(gm, doc);
              }
            }
          }
        } catch (e) {
          logError('Database', e);
        }
      }

      if (gm.data.status === 'playing' && isBotPlayer(gm.data)) {
        triggerBotMove(gm, gameId);
      }

      emitGameRoom(gameId, gm);

      const seatedWhite = mongoId(gm.data.whitePlayer);
      const seatedBlack = mongoId(gm.data.blackPlayer);
      const spectator = !userId || (seatedWhite !== String(userId) && seatedBlack !== String(userId));
      ack?.({
        ok: true,
        spectator,
        status: gm.data.status,
        state: gm.getState(),
      });

      if (mongoose) {
        const { Message } = await getModels();
        if (Message) {
          try {
            const history = await Message.find({ gameId })
              .sort({ createdAt: 1 })
              .limit(30)
              .lean();
            socket.emit('chat:history', { gameId, messages: history });
          } catch (e) {
            logError('Database', e);
          }
        }
      }
    } catch (e) {
      logError('Game', e);
      ack?.({ ok: false, error: 'Internal error' });
    }
  });

  socket.on('game:leave', ({ gameId }) => {
    if (!gameId) return;
    log('Socket', `${socket.id} left game ${gameId}`);
    socket.leave(`game:${gameId}`);
  });

  socket.on('game:move', async ({ gameId, from, to, promotion }, ack) => {
    try {
      if (!userId) return ack?.({ ok: false, error: 'Authentication required' });
      if (!canMoveNow(userId, gameId)) return ack?.({ ok: false, error: 'Slow down' });
      const gm = gameManagers.get(gameId) || (await GameManager.restoreFromMongo(gameId));
      if (!gm) return ack?.({ ok: false, error: 'Game not found' });
      const res = gm.makeMove(userId, from, to, promotion);
      if (!res.ok) return ack?.(res);
      io.to(`game:${gameId}`).emit('game:state', res.state);
      io.to(`game:${gameId}`).emit('game:clock', {
        whiteTime: res.state.whiteTime,
        blackTime: res.state.blackTime,
        turn: res.state.turn,
      });
      if (res.finished) {
        io.to(`game:${gameId}`).emit('game:finished', {
          result: res.state.result,
          termination: res.state.termination,
        });
        log(
          'Game',
          `Game ${gameId} finished: ${res.state.result} (${res.state.termination})`
        );
      }
      ack?.({ ok: true, state: res.state });
      const movePlayed = res.state?.lastMove && res.state.lastMove.from ? { from: res.state.lastMove.from, to: res.state.lastMove.to, promotion: res.state.lastMove.promotion || '' } : { from, to, promotion: promotion || '' };
      trackAntiCheatOnMove(userId, gm, movePlayed);
      await gm.save();
      if (!res.finished) triggerBotMove(gm, gameId);
    } catch (err) {
      logError('Game', err);
      ack?.({ ok: false, error: 'Internal error' });
    }
  });

  socket.on('game:resign', ({ gameId }, ack) => {
    (async () => {
      const gm = gameManagers.get(gameId) || (await GameManager.restoreFromMongo(gameId));
      if (!gm || !userId) return ack?.({ ok: false, error: 'Invalid' });
      const res = gm.resign(userId);
      if (!res.ok) return ack?.(res);
      io.to(`game:${gameId}`).emit('game:state', res.state);
      io.to(`game:${gameId}`).emit('game:finished', {
        result: res.state.result,
        termination: res.state.termination,
      });
      log('Game', `Game ${gameId}: player ${userId} resigned → ${res.state.result}`);
      ack?.({ ok: true });
      await gm.save();
    })();
  });

  socket.on('game:offer-draw', ({ gameId }) => {
    if (!gameId || !userId) return;
    (async () => {
      const gm = gameManagers.get(gameId) || (await GameManager.restoreFromMongo(gameId));
      if (gm && gm.data.status === 'playing') {
        gm.data.drawOfferedBy = userId;
      }
    })();
    io.to(`game:${gameId}`).emit('game:draw-offered', { offeredBy: userId });
    log('Game', `Draw offered in ${gameId} by ${userId}`);
  });
  socket.on('game:accept-draw', ({ gameId }, ack) => {
    (async () => {
      const gm = gameManagers.get(gameId) || (await GameManager.restoreFromMongo(gameId));
      if (!gm) return ack?.({ ok: false });
      const res = gm.finish({ result: 'draw', termination: 'draw_agreement' });
      io.to(`game:${gameId}`).emit('game:state', res.state);
      io.to(`game:${gameId}`).emit('game:finished', {
        result: 'draw',
        termination: 'draw_agreement',
      });
      log('Game', `Draw accepted in ${gameId}`);
      ack?.({ ok: true });
      await gm.save();
    })();
  });
  socket.on('game:decline-draw', ({ gameId }) => {
    io.to(`game:${gameId}`).emit('game:draw-declined');
  });

  socket.on('game:rematch', ({ gameId }) => {
    if (!gameId || !userId) return;
    io.to(`game:${gameId}`).emit('game:rematch-offered', { offeredBy: userId });
    log('Game', `Rematch offered in ${gameId} by ${userId}`);
  });

  socket.on('game:reconnect', async ({ gameId }) => {
    const gm = gameManagers.get(gameId) || (await GameManager.restoreFromMongo(gameId));
    if (gm) {
      socket.join(`game:${gameId}`);
      socket.emit('game:state', gm.getState());
      log('Game', `Player reconnected to ${gameId}`);
    }
  });

  socket.on('chat:message', async ({ gameId, message }, ack) => {
    try {
      if (!gameId || !userId) return ack?.({ ok: false, error: 'Not allowed' });
      if (!canChat(userId)) return ack?.({ ok: false, error: 'Rate limited' });
      const clean = sanitizeText(message, 500);
      if (!clean) return ack?.({ ok: false, error: 'Empty message' });

      const payload = {
        gameId,
        senderId: userId,
        username: socket.handshake.auth?.username || username || 'Player',
        message: clean,
        type: 'chat',
        createdAt: new Date(),
      };
      if (mongoose) {
        try {
          const { Message } = await getModels();
          if (Message) {
            const created = await Message.create(payload);
            payload._id = created._id;
          }
        } catch (e) {
          logError('Database', e);
        }
      }
      io.to(`game:${gameId}`).emit('chat:message', payload);
      ack?.({ ok: true, _id: payload._id, createdAt: payload.createdAt });
    } catch (e) {
      logError('Chat', e);
      ack?.({ ok: false });
    }
  });

  socket.on('video:offer', ({ gameId, toUserId, offer }) => {
    if (!toUserId) return;
    io.to(`user:${toUserId}`).emit('video:offer', { gameId, fromUserId: userId, offer });
    log('WebRTC', `Offer in game ${gameId}`);
  });
  socket.on('video:answer', ({ gameId, toUserId, answer }) => {
    if (!toUserId) return;
    io.to(`user:${toUserId}`).emit('video:answer', { gameId, fromUserId: userId, answer });
  });
  socket.on('video:ice-candidate', ({ gameId, toUserId, candidate }) => {
    if (!toUserId) return;
    io.to(`user:${toUserId}`).emit('video:ice-candidate', {
      gameId,
      fromUserId: userId,
      candidate,
    });
  });

  socket.on('tournament:join', async ({ tournamentId }) => {
    if (!tournamentId || !userId) return;
    try {
      socket.join(`tournament:${tournamentId}`);
      log('Tournament', `${username || userId} joined tournament room ${tournamentId}`);
      await broadcastTournamentStandings(tournamentId);
    } catch (e) { logError('Tournament', e); }
  });
  socket.on('tournament:leave', ({ tournamentId }) => {
    if (!tournamentId) return;
    socket.leave(`tournament:${tournamentId}`);
    log('Tournament', `${username || userId} left tournament room ${tournamentId}`);
  });

  socket.on('user:invite', ({ toUserId, gameId }) => {
    if (!toUserId || !gameId || !userId) return;
    io.to(`user:${toUserId}`).emit('user:invite', {
      fromUserId: userId,
      fromUsername: username || 'Someone',
      gameId,
    });
  });

  socket.on('user:online', () => {
    if (userId) io.emit('user:online', { userId });
  });
  socket.on('user:offline', () => {
    if (userId) io.emit('user:offline', { userId });
  });
});

let _tickStarted = false;
let _qmTickStarted = false;
let _tPairerStarted = false;
let _tCheckStarted = false;

async function start() {
  log('Socket', `Starting Chess Arena Socket.IO server...`);
  log('Socket', `Node.js: ${process.version}`);
  const mongoOk = await connectMongo();
  log('Database', mongoOk ? 'OK' : 'Skipped (no MONGODB_URI)');
  if (mongoOk) {
    const botId = await ensureBotUser();
    log('Bot', botId ? `Bot-Stockfish ready: ${botId.slice(0, 8)}...` : 'Bot skipped (no DB)');
  }

  if (!_tickStarted) {
    _tickStarted = true;
    setInterval(() => {
      try {
        tickAllGames();
      } catch (e) {
        logError('Tick', e);
      }
    }, 1000);
  }
  if (!_qmTickStarted) {
    _qmTickStarted = true;
    setInterval(() => {
      try {
        attemptQuickMatch();
      } catch (e) {
        logError('QuickMatch', e);
      }
    }, 1000);
  }
  if (!_tPairerStarted) {
    _tPairerStarted = true;
    setInterval(() => {
      try {
        tournamentArenaPairer();
      } catch (e) {
        logError('TournamentPairer', e);
      }
    }, 10000);
  }
  if (!_tCheckStarted) {
    _tCheckStarted = true;
    setInterval(() => {
      try {
        checkTournamentStartFinish();
      } catch (e) {
        logError('TournamentCheck', e);
      }
    }, 5000);
  }

  server.listen(PORT, () => {
    log('Socket', `Listening on port ${PORT}`);
    log('Socket', `CORS origin: ${NEXT_APP_URL}`);
    log('Socket', `Run: npm run dev (Next.js) and npm run socket (Socket.IO) separately`);
  });
}

if (require.main === module) {
  start().catch((e) => {
    console.error('[Socket] Fatal:', e);
    process.exit(1);
  });
}

module.exports = { io, server, start, gameManagers, GameManager, quickMatchQueues };
