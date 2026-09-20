import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import {
  validateUsername,
  validateEmail,
  validatePassword,
  setAuthCookie,
} from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    const errors = [];
    errors.push(...validateUsername(username));
    errors.push(...validateEmail(email));
    errors.push(...validatePassword(password));

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    await dbConnect();

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const existingUsername = await User.findOne({ username: trimmedUsername });
    if (existingUsername) {
      return NextResponse.json(
        { errors: ['Username is already taken'] },
        { status: 400 }
      );
    }

    const existingEmail = await User.findOne({ email: trimmedEmail });
    if (existingEmail) {
      return NextResponse.json(
        { errors: ['Email is already registered'] },
        { status: 400 }
      );
    }

    const user = new User({
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash: password,
      isOnline: false,
      lastSeen: new Date(),
    });

    await user.save();

    console.log(`[Auth] User registered: ${user.username} (${user._id})`);

    const response = NextResponse.json(
      {
        user: User.sanitize(user),
        message: 'Registration successful',
      },
      { status: 201 }
    );

    return await setAuthCookie(response, user._id.toString());
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    return NextResponse.json(
      { errors: ['Internal server error. Please try again.'] },
      { status: 500 }
    );
  }
}
