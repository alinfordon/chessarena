import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import TournamentPlayer from '@/models/TournamentPlayer';
import { getCurrentUser } from '@/lib/auth';
import { cacheDelPattern } from '@/lib/cache';
import mongoose from 'mongoose';

export async function POST(req, ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await ctx.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: 'ID turneu invalid' }, { status: 400 });
    }
    await dbConnect();
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return NextResponse.json({ ok: false, error: 'Turneu negăsit' }, { status: 404 });
    }
    if (tournament.status !== 'registration') {
      return NextResponse.json({ ok: false, error: 'Turneul a început, nu poți renunța' }, { status: 400 });
    }
    const deleted = await TournamentPlayer.findOneAndDelete({
      tournamentId: tournament._id,
      userId: user._id,
    });
    if (!deleted) {
      return NextResponse.json({ ok: true, message: 'Nu erai înscris' });
    }
    const count = Math.max(0, (tournament.currentPlayers || 0) - 1);
    tournament.currentPlayers = count;
    tournament.markModified('currentPlayers');
    await tournament.save().catch(() => {});
    try {
      await cacheDelPattern('tournaments:list:');
    } catch {}
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    console.error('[API][tournaments/:id/unregister] Error:', e);
    return NextResponse.json({ ok: false, error: e.message || 'Eroare dezabonare' }, { status: 500 });
  }
}
