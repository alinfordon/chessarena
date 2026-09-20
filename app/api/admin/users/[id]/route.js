import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import BannedUser from '@/models/BannedUser';
import { requireAdmin, isAdminUser, isFounderEmail } from '@/lib/admin';
import { sanitizeText } from '@/utils/validation';

export async function PATCH(req, ctx) {
  try {
    const { user: admin, error } = await requireAdmin();
    if (error) return error;

    const { id } = await ctx.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!['ban', 'unban'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    }

    await dbConnect();
    const target = await User.findById(id).select('username email role');
    if (!target) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }
    if (String(target._id) === String(admin._id)) {
      return NextResponse.json({ ok: false, error: 'You cannot moderate your own account' }, { status: 400 });
    }
    if (isAdminUser(target) || isFounderEmail(target.email)) {
      return NextResponse.json({ ok: false, error: 'You cannot moderate an admin' }, { status: 400 });
    }

    if (action === 'unban') {
      await BannedUser.updateMany(
        { userId: target._id, liftedAt: null },
        { $set: { liftedAt: new Date(), liftedBy: admin.username, expiresAt: new Date() } }
      );
      return NextResponse.json({ ok: true, message: 'User unbanned' });
    }

    const reason = sanitizeText(String(body.reason || 'Banned by an administrator'), 400) || 'Banned by an administrator';
    const severity = body.severity === 'permanent' ? 'permanent' : 'temp';
    const hours = Math.max(1, Math.min(parseInt(body.hours, 10) || 24, 24 * 90));
    const expiresAt = severity === 'permanent' ? null : new Date(Date.now() + hours * 60 * 60 * 1000);

    await BannedUser.create({
      userId: target._id,
      username: target.username,
      reason,
      severity,
      flaggedBy: 'manual',
      expiresAt,
      notes: `Banned by ${admin.username}`,
    });

    return NextResponse.json({ ok: true, message: 'User banned' });
  } catch (e) {
    console.error('[API][admin/users/:id]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
