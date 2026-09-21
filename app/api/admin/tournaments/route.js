import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;
    await dbConnect();
    const tournaments = await Tournament.find({})
      .sort({ official: -1, status: 1, startAt: 1, createdAt: -1 })
      .limit(80)
      .populate({ path: 'createdBy', select: 'username' })
      .lean();

    return NextResponse.json({
      ok: true,
      tournaments: tournaments.map((t) => ({
        _id: String(t._id),
        name: t.name,
        description: t.description || '',
        type: t.type,
        status: t.status,
        official: !!t.official,
        startAt: t.startAt,
        maxPlayers: t.maxPlayers,
        currentPlayers: t.currentPlayers || 0,
        prizePool: t.prizePool || '',
        scoring: t.scoring || { win: 2, draw: 1, loss: 0 },
        prizes: t.prizes || { first: 0, second: 0, third: 0 },
        timeControl: t.timeControl,
        createdBy: t.createdBy?.username || '—',
      })),
    });
  } catch (e) {
    console.error('[API][admin/tournaments]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
