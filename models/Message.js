import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: { type: String, required: true },
    message: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },
    type: {
      type: String,
      enum: ['chat', 'system'],
      default: 'chat',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ gameId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
