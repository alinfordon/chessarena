import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import Game from '@/models/Game';
import User from '@/models/User';
import { createNewGame } from '@/lib/chess';
import { validateTimeControl, sanitizeText } from '@/utils/validation';
import { getRatingCategory } from '@/lib/rating';
import { cacheGet, cacheSet, cacheDelPattern } from '@/lib/cache';

export async function POST(req) {
  try {
    // #region debug-point api-games-post
    const user = await getCurrentUser();
    if (!user) {
      console.error('[DEBUG /api/games:POST] ❌ No authenticated user found (401)');
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const initialTime = Number(body?.initialTime);
    const increment = Number(body?.increment ?? 0);
    const isPrivate = body?.isPrivate === true;
    const colorPreference = body?.colorPreference;
    const opponentUserId = body?.opponentUserId || null;
    const botMode = body?.botMode === true;
    const botLevel = Math.min(10, Math.max(1, Number(body?.botLevel ?? 5)));
    console.log(
      `[DEBUG /api/games:POST] 👉 Incoming: user=${user.username} (${user._id.toString().slice(0,8)}) botMode=${botMode} botLevel=${botLevel} time=${initialTime}/${increment} oppId=${opponentUserId || 'none'}`
    );

    const errors = validateTimeControl(initialTime, increment);
    if (
      colorPreference &&
      !['white', 'black', 'random'].includes(String(colorPreference))
    ) {
      errors.push('Invalid color preference');
    }
    if (errors.length) {
      return NextResponse.json({ ok: false, error: errors[0] }, { status: 400 });
    }

    let opponent = null;
    if (opponentUserId) {
      opponent = await User.findById(opponentUserId).select(
        'username rating blitzRating rapidRating classicalRating'
      );
      if (!opponent) {
        return NextResponse.json({ ok: false, error: 'Opponent not found' }, { status: 404 });
      }
    }

    if (botMode && !opponent) {
      console.log(`[DEBUG /api/games:POST] 🤖 botMode active. Finding/creating Bot_Stockfish user...`);
      let botUser = await User.findOne({ username: 'Bot_Stockfish' }).select(
        'username rating blitzRating rapidRating classicalRating'
      );
      console.log(`[DEBUG /api/games:POST] 🔎 findOne result: exists=${!!botUser}`);
      if (!botUser) {
        console.log(`[DEBUG /api/games:POST] 🆕 Creating Bot_Stockfish user in MongoDB via User.create ...`);
        const bcrypt = (await import('bcryptjs')).default;
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash('bot-password-' + Date.now(), salt);
        try {
          const botDoc = await User.create({
            username: 'Bot_Stockfish',
            email: 'bot@stockfish.chess',
            passwordHash,
            rating: 1200 + botLevel * 80,
            blitzRating: 1200 + botLevel * 80,
            rapidRating: 1200 + botLevel * 80,
            classicalRating: 1200 + botLevel * 80,
          });
          console.log(`[DEBUG /api/games:POST] ✅ Bot user created! _id=${botDoc._id.toString().slice(0,12)} username=${botDoc.username}`);
          botUser = {
            _id: botDoc._id,
            username: botDoc.username,
            rating: botDoc.rating,
            blitzRating: botDoc.blitzRating,
            rapidRating: botDoc.rapidRating,
            classicalRating: botDoc.classicalRating,
          };
        } catch (createErr) {
          console.error(`[DEBUG /api/games:POST] 💥 BOT CREATE FAILED:`, createErr?.message, createErr?.stack);
          throw createErr;
        }
      } else {
        console.log(`[DEBUG /api/games:POST] ✅ Reused existing Bot user _id=${botUser._id.toString().slice(0,12)}`);
      }
      opponent = botUser;
    }

    const ratingCategory = getRatingCategory(initialTime);
    const uRating = user[ratingCategory] || user.rating || 1200;
    const oRating = opponent
      ? opponent[ratingCategory] || opponent.rating || 1200
      : null;

    const color =
      colorPreference === 'white'
        ? 'white'
        : colorPreference === 'black'
          ? 'black'
          : Math.random() < 0.5
            ? 'white'
            : 'black';

    const base = {
      initialTime,
      increment,
      isPrivate,
      ratingCategory,
      createdBy: user._id,
      whitePlayer: null,
      blackPlayer: null,
      whiteUsername: null,
      blackUsername: null,
      whiteRating: 1200,
      blackRating: 1200,
    };

    if (color === 'white') {
      base.whitePlayer = user._id;
      base.whiteUsername = user.username;
      base.whiteRating = uRating;
      if (opponent) {
        base.blackPlayer = opponent._id;
        base.blackUsername = opponent.username;
        base.blackRating = oRating;
      }
    } else {
      base.blackPlayer = user._id;
      base.blackUsername = user.username;
      base.blackRating = uRating;
      if (opponent) {
        base.whitePlayer = opponent._id;
        base.whiteUsername = opponent.username;
        base.whiteRating = oRating;
      }
    }

    const payload = createNewGame(base);
    if (opponent && base.whitePlayer && base.blackPlayer) {
      payload.status = 'playing';
      payload.startedAt = new Date();
    }
    if (botMode) {
      payload.botLevel = botLevel;
    }
    console.log(
      `[DEBUG /api/games:POST] 📝 Game.create payload: status=${payload.status} white=${base.whiteUsername || ''} whiteId=${String(base.whitePlayer || '').slice(0,8)} vs black=${base.blackUsername || ''} blackId=${String(base.blackPlayer || '').slice(0,8)} botLevel=${payload.botLevel || 'n/a'}`
    );
    const game = await Game.create(payload);
    console.log(`[DEBUG /api/games:POST] ✅ Game.created! id=${game.gameId} _id=${game._id.toString().slice(0,12)} status=${game.status}`);

    try {
      await cacheDelPattern('games:list:');
      if (process.env.NEXT_PUBLIC_SOCKET_URL) {
        fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/notify?type=lobby-new&gameId=${payload.gameId}`, {
          method: 'POST',
        }).catch(() => {});
      }
    } catch {}

    return NextResponse.json(
      {
        ok: true,
        gameId: game.gameId,
        status: game.status,
        inviteCode: isPrivate ? game.inviteCode : null,
        ratingCategory,
        initialTime,
        increment,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('[DEBUG /api/games] POST error:', e.message, '\nSTACK:', e.stack);
    return NextResponse.json(
      { ok: false, error: e.message || 'Internal error. Please try again.' },
      { status: 500 }
    );
  }
  // #endregion
}

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const statusParam = String(searchParams.get('status') || 'waiting,playing,finished');
    const limitRaw = Number(searchParams.get('limit') || 50);
    const limit = Math.min(Math.max(1, limitRaw || 50), 200);
    const statuses = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const cacheKey = `games:list:${statusParam}:${limit}`;
    const includeWaiting = statuses.includes('waiting');
    const cached = includeWaiting ? null : await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const filters = statuses.length ? { status: { $in: statuses } } : {};
    const docs = await Game.find(filters)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        'gameId whitePlayer blackPlayer whiteUsername blackUsername whiteRating blackRating ratingCategory initialTime increment status result startedAt createdAt moves isPrivate'
      )
      .populate('whitePlayer', 'username avatar rating isOnline')
      .populate('blackPlayer', 'username avatar rating isOnline')
      .lean();

    const games = docs.map((g) => ({
      gameId: g.gameId,
      status: g.status,
      result: g.result || null,
      termination: g.termination || null,
      ratingCategory: g.ratingCategory,
      initialTime: g.initialTime,
      increment: g.increment,
      movesCount: Array.isArray(g.moves) ? g.moves.length : 0,
      whiteUsername: g.whiteUsername || g.whitePlayer?.username || null,
      blackUsername: g.blackUsername || g.blackPlayer?.username || null,
      whiteRating: g.whiteRating || g.whitePlayer?.rating || 1200,
      blackRating: g.blackRating || g.blackPlayer?.rating || 1200,
      isPrivate: !!g.isPrivate,
      whitePlayer: g.whitePlayer
        ? {
            _id: g.whitePlayer._id?.toString?.() || g.whitePlayer,
            username: g.whiteUsername || g.whitePlayer?.username || '',
            rating: g.whiteRating || g.whitePlayer?.rating || 1200,
            avatar: g.whitePlayer?.avatar || null,
            isOnline: !!g.whitePlayer?.isOnline,
          }
        : null,
      blackPlayer: g.blackPlayer
        ? {
            _id: g.blackPlayer._id?.toString?.() || g.blackPlayer,
            username: g.blackUsername || g.blackPlayer?.username || '',
            rating: g.blackRating || g.blackPlayer?.rating || 1200,
            avatar: g.blackPlayer?.avatar || null,
            isOnline: !!g.blackPlayer?.isOnline,
          }
        : null,
      startedAt: g.startedAt || null,
      createdAt: g.createdAt || null,
    }));

    const response = { ok: true, games };
    if (!includeWaiting) {
      await cacheSet(cacheKey, response, 60);
    }

    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    console.error('[API /api/games] GET error:', e.message);
    return NextResponse.json(
      { ok: false, error: 'Internal error. Please try again.', games: [] },
      { status: 500 }
    );
  }
}
