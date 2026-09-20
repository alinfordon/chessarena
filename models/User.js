import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username must be at most 20 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    avatar: {
      type: String,
      default: function () {
        const colors = ['#0c85f0', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const initials = this.username.substring(0, 2).toUpperCase();
        return `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/><text x="50" y="50" font-family="Inter,Arial" font-size="40" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`
        )}`;
      },
    },
    rating: {
      type: Number,
      default: 1200,
    },
    blitzRating: {
      type: Number,
      default: 1200,
    },
    rapidRating: {
      type: Number,
      default: 1200,
    },
    classicalRating: {
      type: Number,
      default: 1200,
    },
    gamesPlayed: {
      type: Number,
      default: 0,
    },
    gamesWon: {
      type: Number,
      default: 0,
    },
    gamesDraw: {
      type: Number,
      default: 0,
    },
    gamesLost: {
      type: Number,
      default: 0,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

UserSchema.index({ rating: -1 });
UserSchema.index({ isOnline: 1 });

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.email;
  delete obj.__v;
  return obj;
};

UserSchema.statics.sanitize = function (user) {
  if (!user) return null;
  const { passwordHash, email, __v, ...sanitized } = user.toObject ? user.toObject() : user;
  return sanitized;
};

export default mongoose.models.User || mongoose.model('User', UserSchema);
