import mongoose from 'mongoose';

const BannedUserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    username: { type: String, trim: true },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: 'Suspected use of a chess engine (anti-cheat)',
    },
    severity: {
      type: String,
      enum: ['warning', 'temp', 'permanent'],
      default: 'temp',
      index: true,
    },
    flaggedBy: {
      type: String,
      enum: ['system', 'manual', 'report'],
      default: 'system',
    },
    accuracyAtBan: { type: Number },
    consecutiveTopMoves: { type: Number },
    gamesAnalyzed: { type: Number },
    expiresAt: { type: Date, index: true },
    liftedAt: Date,
    liftedBy: String,
    notes: String,
  },
  { timestamps: true }
);

BannedUserSchema.index({ userId: 1, severity: 1 });
BannedUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

BannedUserSchema.statics.isUserBanned = async function (userId) {
  if (!userId) return { banned: false };
  try {
    const active = await this.findOne({
      userId,
      severity: { $ne: 'warning' },
      $or: [
        { liftedAt: null, expiresAt: { $gt: new Date() } },
        { severity: 'permanent', liftedAt: null },
      ],
    }).sort({ createdAt: -1 }).lean();
    if (!active) return { banned: false };
    return {
      banned: true,
      reason: active.reason,
      severity: active.severity,
      expiresAt: active.expiresAt,
      flaggedBy: active.flaggedBy,
    };
  } catch (e) {
    return { banned: false };
  }
};

export default mongoose.models.BannedUser || mongoose.model('BannedUser', BannedUserSchema);
