import mongoose from 'mongoose';

const MoveSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    san: { type: String },
    lan: { type: String },
    piece: { type: String },
    captured: { type: String },
    promotion: { type: String },
    flags: { type: String },
    timeSpent: { type: Number, default: 0 },
    whiteTime: { type: Number },
    blackTime: { type: Number },
    fenBefore: { type: String },
    fenAfter: { type: String },
  },
  { _id: false }
);

const GameSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    whitePlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    blackPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    whiteUsername: String,
    blackUsername: String,
    whiteRating: { type: Number, default: 1200 },
    blackRating: { type: Number, default: 1200 },
    ratingCategory: {
      type: String,
      enum: ['blitzRating', 'rapidRating', 'classicalRating'],
      default: 'rapidRating',
    },
    initialTime: { type: Number, required: true },
    increment: { type: Number, default: 0 },
    whiteTime: { type: Number, required: true },
    blackTime: { type: Number, required: true },
    lastMoveAt: { type: Date },
    fen: {
      type: String,
      required: true,
      default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    },
    turn: {
      type: String,
      enum: ['w', 'b'],
      default: 'w',
    },
    moves: [MoveSchema],
    status: {
      type: String,
      enum: ['waiting', 'playing', 'finished', 'aborted'],
      default: 'waiting',
      index: true,
    },
    result: {
      type: String,
      enum: ['white', 'black', 'draw', null],
      default: null,
    },
    termination: {
      type: String,
      enum: [
        'checkmate',
        'timeout',
        'resignation',
        'draw_agreement',
        'stalemate',
        'threefold_repetition',
        'insufficient_material',
        'disconnect',
        'aborted',
        null,
      ],
      default: null,
    },
    isPrivate: { type: Boolean, default: false },
    inviteCode: String,
    drawOfferedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rematchOfferedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now, index: true },
    startedAt: Date,
    finishedAt: Date,
  },
  { strict: false }
);

GameSchema.index({ status: 1, createdAt: -1 });
GameSchema.index({ whitePlayer: 1, createdAt: -1 });
GameSchema.index({ blackPlayer: 1, createdAt: -1 });

GameSchema.statics.generateGameId = function () {
  return (
    'g_' +
    Math.random().toString(36).substring(2, 10) +
    Date.now().toString(36)
  );
};

export default mongoose.models.Game || mongoose.model('Game', GameSchema);
