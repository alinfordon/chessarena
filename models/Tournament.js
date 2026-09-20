import mongoose from 'mongoose';

const TournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    type: {
      type: String,
      required: true,
      enum: ['arena', 'swiss', 'round_robin', 'single_elimination'],
      index: true,
    },
    timeControl: {
      type: {
        initialTime: { type: Number, required: true },
        increment: { type: Number, default: 0 },
        label: String,
      },
      required: true,
    },
    maxPlayers: { type: Number, required: true, default: 16 },
    currentPlayers: { type: Number, default: 0, index: true },
    minRating: { type: Number, default: 0 },
    maxRating: { type: Number, default: 3000 },
    prizePool: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['registration', 'live', 'finished', 'cancelled'],
      default: 'registration',
      index: true,
    },
    startAt: { type: Date, required: true },
    durationMs: Number,
    rounds: { type: Number, default: 0 },
    currentRound: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    winners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    pairingAlgorithm: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'auto',
    },
    allowByes: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TournamentSchema.index({ status: 1, startAt: 1 });
TournamentSchema.index({ createdBy: 1, createdAt: -1 });

TournamentSchema.pre('save', function (next) {
  if (!this.isNew) return next();
  if (this.type === 'round_robin' && this.maxPlayers > 0) {
    this.rounds = this.maxPlayers % 2 === 0 ? this.maxPlayers - 1 : this.maxPlayers;
  } else if (this.type === 'swiss') {
    this.rounds = this.rounds || Math.ceil(Math.log2(this.maxPlayers || 16) * 1.5);
  } else if (this.type === 'single_elimination') {
    this.rounds = Math.ceil(Math.log2(this.maxPlayers || 16));
  }
  next();
});

export default mongoose.models.Tournament || mongoose.model('Tournament', TournamentSchema);
