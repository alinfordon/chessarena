import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Game from '@/models/Game';
import Tournament from '@/models/Tournament';
import { requireAdmin, ensureFounderAdmin } from '@/lib/admin';

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;
    await dbConnect();
    await ensureFounderAdmin();

    const [users, online, gamesPlaying, gamesToday, tournamentsLive, tournamentsReg, official] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isOnline: true }),
      Game.countDocuments({ status: 'playing' }),
      Game.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      Tournament.countDocuments({ status: 'live' }),
      Tournament.countDocuments({ status: 'registration' }),
      Tournament.countDocuments({ official: true, status: { $in: ['registration', 'live'] } }),
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        users,
        online,
        gamesPlaying,
        gamesToday,
        tournamentsLive,
        tournamentsReg,
        official,
      },
    });
  } catch (e) {
    console.error('[API][admin/stats]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
