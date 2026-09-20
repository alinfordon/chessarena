import { Chess } from 'chess.js';

export function createChessInstance(fen = null) {
  try {
    return fen ? new Chess(fen) : new Chess();
  } catch (e) {
    return new Chess();
  }
}

export function validateMove(fen, from, to, promotion = null) {
  const chess = createChessInstance(fen);
  try {
    const opts = { from, to };
    if (promotion) opts.promotion = promotion;
    const move = chess.move(opts);
    if (!move) return { valid: false };
    return {
      valid: true,
      move,
      newFen: chess.fen(),
      turn: chess.turn(),
      isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
      isThreefoldRepetition: chess.isThreefoldRepetition(),
      isInsufficientMaterial: chess.isInsufficientMaterial(),
      isCheck: chess.isCheck(),
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

export function getLegalMoves(fen, square = null) {
  const chess = createChessInstance(fen);
  try {
    if (square) {
      return chess.moves({ square, verbose: true });
    }
    return chess.moves({ verbose: true });
  } catch (e) {
    return [];
  }
}

export function timeControlToCategory(initialTimeSeconds) {
  if (initialTimeSeconds < 180) return { key: 'blitzRating', label: 'Blitz' };
  if (initialTimeSeconds < 600) return { key: 'rapidRating', label: 'Rapid' };
  return { key: 'classicalRating', label: 'Classical' };
}

export function generateGameId() {
  return 'g_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function openingFromMoves() {
  return 'Standard Opening';
}

export default {
  createChessInstance,
  validateMove,
  getLegalMoves,
  timeControlToCategory,
  generateGameId,
  generateInviteCode,
};
