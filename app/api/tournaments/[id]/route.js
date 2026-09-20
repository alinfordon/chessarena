import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import TournamentPlayer from '@/models/TournamentPlayer';
import Game from '@/models/Game';
import { getCurrentUser } from '@/lib/auth';
import mongoose from 'mongoose';

export async function GET(req, ctx) {
  try {
    await dbConnect();
    const { id } = await ctx.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid tournament ID' }, { status: 400 });
    }

    const t = await Tournament.findById(id)
      .populate({ path: 'createdBy', select: 'username avatar rating' })
      .populate({ path: 'winners', select: 'username avatar rating' })
      .lean();
    if (!t) {
      return NextResponse.json({ ok: false, error: 'Tournament not found' }, { status: 404 });
    }

    const [players, pairings, user] = await Promise.all([
      TournamentPlayer.find({ tournamentId: t._id })
        .sort({ score: -1, buchholz: -1, sonnebornBerger: -1, rating: -1 })
        .lean(),
      Game.find({
        $or: [{ whitePlayer: { $in: players.map(p => p.userId) } }, { blackPlayer: { $in: players.map(p => p.userId) } }],
        tournamentId: t._id.toString(),
      }).sort({ startedAt: -1 }).limit(100).lean().catch(() => []),
      getCurrentUser().catch(() => null),
    ]);

    const playersWithRank = players.map((p, i) => ({
      ...p,
      _id: p._id.toString(),
      tournamentId: undefined,
      userId: p.userId.toString(),
      rank: i + 1,
    }));

    const pairingsLean = pairings.map(g => ({
      gameId: g.gameId,
      whiteUsername: g.whiteUsername,
      blackUsername: g.blackUsername,
      whiteRating: g.whiteRating,
      blackRating: g.blackRating,
      status: g.status,
      result: g.result,
      moves: g.moves?.length || 0,
      startedAt: g.startedAt,
      finishedAt: g.finishedAt,
    }));

    const tournamentLean = {
      ...t,
      _id: t._id.toString(),
      createdBy: t.createdBy ? { ...t.createdBy, _id: t.createdBy._id.toString() } : null,
      winners: (t.winners || []).map(w => w && typeof w === 'object' ? { ...w, _id: w._id.toString() } : w),
      currentPlayers: players.length,
      userRegistered: user ? players.some(p => p.userId.toString() === user._id.toString()) : false,
      canRegister: user && t.status === 'registration' && players.length < t.maxPlayers
        && user.rating >= t.minRating && user.rating <= t.maxRating
        && !players.some(p => p.userId.toString() === user._id.toString()),
    };

    return NextResponse.json({
      ok: true,
      tournament: tournamentLean,
      players: playersWithRank,
      pairings: pairingsLean,
      userId: user ? user._id.toString() : null,
    });
  } catch (e) {
    console.error('[API][tournaments/:id] GET Error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
