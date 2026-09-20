import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Game from '@/models/Game';
import TournamentPlayer from '@/models/TournamentPlayer';
import Message from '@/models/Message';
import BannedUser from '@/models/BannedUser';
import { getCurrentUser, validateUsername } from '@/lib/auth';
import { sanitizeText } from '@/utils/validation';
import {
  buildInitialsAvatar,
  extractAvatarColor,
  isGeneratedAvatar,
  validateAvatarDataUrl,
} from '@/utils/avatar';

function ownerPayload(user) {
  const sanitized = User.sanitize(user);
  return {
    ...sanitized,
    email: user.email,
    _id: String(user._id),
  };
}

export async function PATCH(request) {
  try {
    const current = await getCurrentUser();
    if (!current) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(current._id);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const errors = [];
    let nextUsername = user.username;
    let nextAvatar = user.avatar;

    if (body.username !== undefined) {
      const username = sanitizeText(String(body.username), 20);
      errors.push(...validateUsername(username));
      if (username.toLowerCase() === 'bot_stockfish') {
        errors.push('This username is reserved');
      }
      nextUsername = username;
    }

    if (errors.length) {
      return NextResponse.json({ ok: false, errors }, { status: 400 });
    }

    if (nextUsername !== user.username) {
      const taken = await User.findOne({
        username: nextUsername,
        _id: { $ne: user._id },
      }).select('_id');
      if (taken) {
        return NextResponse.json({ ok: false, errors: ['Username is already taken'] }, { status: 400 });
      }
    }

    if (body.avatar !== undefined) {
      const avatarError = validateAvatarDataUrl(body.avatar);
      if (avatarError) {
        return NextResponse.json({ ok: false, errors: [avatarError] }, { status: 400 });
      }
      nextAvatar = body.avatar;
    } else if (body.avatarColor) {
      nextAvatar = buildInitialsAvatar(nextUsername, body.avatarColor);
    } else if (nextUsername !== user.username && isGeneratedAvatar(user.avatar)) {
      nextAvatar = buildInitialsAvatar(nextUsername, extractAvatarColor(user.avatar));
    }

    const usernameChanged = nextUsername !== user.username;
    const avatarChanged = nextAvatar !== user.avatar;

    user.username = nextUsername;
    user.avatar = nextAvatar;
    await user.save();

    if (usernameChanged || avatarChanged) {
      const uid = user._id;
      const ops = [];
      if (usernameChanged) {
        ops.push(
          Game.updateMany({ whitePlayer: uid }, { $set: { whiteUsername: nextUsername } }),
          Game.updateMany({ blackPlayer: uid }, { $set: { blackUsername: nextUsername } }),
          Message.updateMany({ senderId: uid }, { $set: { username: nextUsername } }),
          BannedUser.updateMany({ userId: uid }, { $set: { username: nextUsername } })
        );
      }
      const playerSet = {};
      if (usernameChanged) playerSet.username = nextUsername;
      if (avatarChanged) playerSet.avatar = nextAvatar;
      if (Object.keys(playerSet).length) {
        ops.push(TournamentPlayer.updateMany({ userId: uid }, { $set: playerSet }));
      }
      await Promise.all(ops);
    }

    return NextResponse.json({ ok: true, user: ownerPayload(user) });
  } catch (e) {
    console.error('[API][me/profile]', e);
    return NextResponse.json({ ok: false, error: 'Could not update profile' }, { status: 500 });
  }
}
