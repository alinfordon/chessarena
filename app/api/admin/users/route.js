import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import BannedUser from '@/models/BannedUser';
import { requireAdmin, isAdminUser } from '@/lib/admin';
import { sanitizeText } from '@/utils/validation';

export async function GET(req) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const q = sanitizeText(searchParams.get('q') || '', 80);
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '40', 10), 100));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ username: rx }, { email: rx }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select('username email avatar rating gamesPlayed gamesWon isOnline lastSeen role createdAt')
        .lean(),
    ]);

    const ids = users.map((u) => u._id);
    const bans = await BannedUser.find({
      userId: { $in: ids },
      severity: { $ne: 'warning' },
      liftedAt: null,
      $or: [{ expiresAt: { $gt: new Date() } }, { severity: 'permanent' }],
    })
      .sort({ createdAt: -1 })
      .lean();

    const banByUser = new Map();
    for (const b of bans) {
      const key = String(b.userId);
      if (!banByUser.has(key)) banByUser.set(key, b);
    }

    return NextResponse.json({
      ok: true,
      total,
      limit,
      offset,
      users: users.map((u) => {
        const ban = banByUser.get(String(u._id));
        return {
          _id: String(u._id),
          username: u.username,
          email: u.email,
          avatar: u.avatar || null,
          rating: u.rating ?? 1200,
          gamesPlayed: u.gamesPlayed || 0,
          gamesWon: u.gamesWon || 0,
          isOnline: !!u.isOnline,
          lastSeen: u.lastSeen,
          role: u.role || (isAdminUser(u) ? 'admin' : 'user'),
          createdAt: u.createdAt,
          banned: !!ban,
          ban: ban
            ? {
                reason: ban.reason,
                severity: ban.severity,
                expiresAt: ban.expiresAt || null,
              }
            : null,
        };
      }),
    });
  } catch (e) {
    console.error('[API][admin/users]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
