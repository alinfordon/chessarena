import { Chess } from 'chess.js';
import { generateGameId, generateInviteCode, timeControlToCategory } from '@/utils/chess';
import { getRatingCategory } from './rating';

export function createNewGame({
  whitePlayer = null,
  blackPlayer = null,
  whiteUsername = '',
  blackUsername = '',
  whiteRating = 1200,
  blackRating = 1200,
  initialTime = 300,
  increment = 0,
  isPrivate = false,
  createdBy = null,
}) {
  const gameId = generateGameId();
  const category = getRatingCategory(initialTime);
  return {
    gameId,
    whitePlayer,
    blackPlayer,
    whiteUsername,
    blackUsername,
    whiteRating,
    blackRating,
    ratingCategory: category,
    initialTime,
    increment,
    whiteTime: initialTime,
    blackTime: initialTime,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    moves: [],
    status: 'waiting',
    result: null,
    termination: null,
    isPrivate,
    inviteCode: isPrivate ? generateInviteCode() : null,
    drawOfferedBy: null,
    rematchOfferedBy: null,
    createdAt: new Date(),
    startedAt: null,
    finishedAt: null,
    createdBy,
  };
}

export function getChessInstance(fen) {
  return new Chess(fen);
}

export { getLegalMoves, validateMove } from '@/utils/chess';
export default { createNewGame, getChessInstance };
