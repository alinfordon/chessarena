import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getCurrentUser, FOUNDER_EMAIL, isFounderEmail } from '@/lib/auth';

export { FOUNDER_EMAIL, isFounderEmail };

export function isAdminUser(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return isFounderEmail(user.email);
}

export async function ensureFounderAdmin() {
  try {
    await dbConnect();
    await User.updateOne(
      { email: FOUNDER_EMAIL },
      { $set: { role: 'admin' } }
    );
  } catch (e) {
    console.warn('[Admin] Could not ensure founder admin:', e?.message || e);
  }
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (isFounderEmail(user.email) && user.role !== 'admin') {
    await User.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
    user.role = 'admin';
  }
  if (!isAdminUser(user)) {
    return {
      user,
      error: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { user, error: null };
}
