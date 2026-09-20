import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { setAuthCookie } from '@/lib/auth';
import { sanitizeText } from '@/utils/validation';

const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const attemptCache = new Map();

function checkRateLimit(identifier) {
  const now = Date.now();
  const record = attemptCache.get(identifier);
  if (!record) {
    attemptCache.set(identifier, { count: 1, firstAttempt: now });
    return true;
  }
  if (now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    attemptCache.set(identifier, { count: 1, firstAttempt: now });
    return true;
  }
  record.count += 1;
  if (record.count > MAX_ATTEMPTS) {
    return false;
  }
  return true;
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { errors: ['Too many login attempts. Please try again later.'] },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { errors: ['Username or email is required'] },
        { status: 400 }
      );
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { errors: ['Password is required'] },
        { status: 400 }
      );
    }

    const cleanIdentifier = sanitizeText(identifier, 100).trim().toLowerCase();

    await dbConnect();

    const user = await User.findOne({
      $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }],
    });

    if (!user) {
      return NextResponse.json(
        { errors: ['Invalid credentials'] },
        { status: 401 }
      );
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return NextResponse.json(
        { errors: ['Invalid credentials'] },
        { status: 401 }
      );
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    console.log(`[Auth] User logged in: ${user.username} (${user._id})`);

    const response = NextResponse.json(
      {
        user: User.sanitize(user),
        message: 'Login successful',
      },
      { status: 200 }
    );

    return await setAuthCookie(response, user._id.toString());
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { errors: ['Internal server error. Please try again.'] },
      { status: 500 }
    );
  }
}
