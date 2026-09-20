import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getCurrentUser, validatePassword } from '@/lib/auth';

export async function POST(request) {
  try {
    const current = await getCurrentUser();
    if (!current) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ ok: false, errors: ['Current password is required'] }, { status: 400 });
    }

    const pwErrors = validatePassword(newPassword);
    if (pwErrors.length) {
      return NextResponse.json({ ok: false, errors: pwErrors }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { ok: false, errors: ['New password must be different from the current password'] },
        { status: 400 }
      );
    }

    await dbConnect();
    const user = await User.findById(current._id);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return NextResponse.json({ ok: false, errors: ['Current password is incorrect'] }, { status: 400 });
    }

    user.passwordHash = newPassword;
    await user.save();

    return NextResponse.json({ ok: true, message: 'Password updated' });
  } catch (e) {
    console.error('[API][me/password]', e);
    return NextResponse.json({ ok: false, error: 'Could not update password' }, { status: 500 });
  }
}
