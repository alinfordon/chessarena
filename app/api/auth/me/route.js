import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser, COOKIE_NAME } from '@/lib/auth';
import { isAdminUser } from '@/lib/admin';
import User from '@/models/User';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(COOKIE_NAME)?.value || null;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null, socketToken: null }, { status: 200 });
    }
    const sanitized = User.sanitize(user);
    sanitized.role = isAdminUser(user) ? 'admin' : 'user';
    return NextResponse.json(
      { user: sanitized, socketToken: rawToken },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Auth] Me error:', error);
    return NextResponse.json(
      { errors: ['Internal server error'] },
      { status: 500 }
    );
  }
}
