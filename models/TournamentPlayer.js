import mongoose from 'mongoose';

const TournamentPlayerSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    username: String,
    avatar: String,
    rating: { type: Number, required: true, default: 1200 },
    seed: { type: Number },
    score: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    buchholz: { type: Number, default: 0 },
    sonnebornBerger: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['registered', 'active', 'eliminated', 'withdrawn', 'finished'],
      default: 'registered',
      index: true,
    },
    tiebreak: { type: Number, default: 0 },
    dropped: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TournamentPlayerSchema.index({ tournamentId: 1, userId: 1 }, { unique: true });
TournamentPlayerSchema.index({ tournamentId: 1, score: -1, buchholz: -1 });

export default mongoose.models.TournamentPlayer ||
  mongoose.model('TournamentPlayer', TournamentPlayerSchema);
