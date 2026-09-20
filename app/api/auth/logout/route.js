import { NextResponse } from 'next/server';
import { clearAuthCookie, getCurrentUser } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (user) {
      await dbConnect();
      await User.findByIdAndUpdate(user._id, {
        isOnline: false,
        lastSeen: new Date(),
      });
      console.log(`[Auth] User logged out: ${user.username} (${user._id})`);
    }

    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

    return clearAuthCookie(response);
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return NextResponse.json(
      { errors: ['Internal server error'] },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
