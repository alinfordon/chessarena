import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import TournamentPlayer from '@/models/TournamentPlayer';
import { getCurrentUser } from '@/lib/auth';
import { isValidId } from '@/utils/validation';
import { cacheDelPattern } from '@/lib/cache';

export async function POST(req, ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await ctx.params;
    if (!id || !isValidId(id)) {
      return NextResponse.json({ ok: false, error: 'ID turneu invalid' }, { status: 400 });
    }
    await dbConnect();

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return NextResponse.json({ ok: false, error: 'Turneu negăsit' }, { status: 404 });
    }
    if (tournament.status !== 'registration') {
      return NextResponse.json({ ok: false, error: 'Înscrierile sunt închise' }, { status: 400 });
    }
    const count = await TournamentPlayer.countDocuments({ tournamentId: tournament._id });
    if (count >= tournament.maxPlayers) {
      return NextResponse.json({ ok: false, error: 'Turneu plin' }, { status: 400 });
    }
    if (user.rating < tournament.minRating || user.rating > tournament.maxRating) {
      return NextResponse.json(
        { ok: false, error: `Rating ${user.rating} în afara intervalului [${tournament.minRating}-${tournament.maxRating}]` },
        { status: 400 }
      );
    }
    const existing = await TournamentPlayer.findOne({ tournamentId: tournament._id, userId: user._id });
    if (existing) {
      return NextResponse.json({ ok: true, message: 'Deja înregistrat', playerId: existing._id.toString() });
    }

    const doc = new TournamentPlayer({
      tournamentId: tournament._id,
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      rating: user.rating,
      seed: count + 1,
      status: 'registered',
    });
    await doc.save();

    const newCount = count + 1;
    if (newCount === tournament.maxPlayers && tournament.type === 'round_robin') {
      tournament.rounds = newCount % 2 === 0 ? newCount - 1 : newCount;
    }
    tournament.currentPlayers = newCount;
    tournament.markModified('currentPlayers');
    await tournament.save().catch(() => {});
    try {
      await cacheDelPattern('tournaments:list:');
    } catch {}

    return NextResponse.json({
      ok: true,
      playerId: doc._id.toString(),
      count: newCount,
    }, { status: 201 });
  } catch (e) {
    console.error('[API][tournaments/:id/register] Error:', e);
    return NextResponse.json({ ok: false, error: e.message || 'Eroare înscriere' }, { status: 500 });
  }
}
