import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import Game from '@/models/Game';

export async function GET(req, ctx) {
  try {
    const { id } = await ctx.params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid game id' }, { status: 400 });
    }
    await dbConnect();
    const doc = await Game.findOne({ gameId: id })
      .populate('whitePlayer', 'username avatar rating isOnline')
      .populate('blackPlayer', 'username avatar rating isOnline')
      .lean();
    if (!doc) {
      return NextResponse.json({ ok: false, error: 'Game not found' }, { status: 404 });
    }
    const user = await getCurrentUser().catch(() => null);
    const uid = user?._id?.toString();
    const isParticipant =
      uid &&
      (String(doc.whitePlayer?._id || doc.whitePlayer) === uid ||
        String(doc.blackPlayer?._id || doc.blackPlayer) === uid);

    const publicGame = {
      gameId: doc.gameId,
      status: doc.status,
      result: doc.result || null,
      termination: doc.termination || null,
      ratingCategory: doc.ratingCategory,
      initialTime: doc.initialTime,
      increment: doc.increment,
      fen: doc.fen,
      turn: doc.turn,
      whiteTime: doc.whiteTime,
      blackTime: doc.blackTime,
      isPrivate: !!doc.isPrivate,
      lastMoveAt: doc.lastMoveAt || null,
      startedAt: doc.startedAt || null,
      finishedAt: doc.finishedAt || null,
      createdAt: doc.createdAt || null,
      drawOfferedBy: doc.drawOfferedBy || null,
      rematchOfferedBy: doc.rematchOfferedBy || null,
      ratingDeltaWhite: doc.ratingDeltaWhite ?? null,
      ratingDeltaBlack: doc.ratingDeltaBlack ?? null,
      whitePlayerId: doc.whitePlayer ? String(doc.whitePlayer) : null,
      blackPlayerId: doc.blackPlayer ? String(doc.blackPlayer) : null,
      whitePlayer: doc.whitePlayer
        ? {
            _id: doc.whitePlayer._id?.toString?.() || doc.whitePlayer,
            username: doc.whiteUsername || doc.whitePlayer?.username || '',
            rating: doc.whiteRating || doc.whitePlayer?.rating || 1200,
            avatar: doc.whitePlayer?.avatar || null,
            isOnline: !!doc.whitePlayer?.isOnline,
          }
        : null,
      blackPlayer: doc.blackPlayer
        ? {
            _id: doc.blackPlayer._id?.toString?.() || doc.blackPlayer,
            username: doc.blackUsername || doc.blackPlayer?.username || '',
            rating: doc.blackRating || doc.blackPlayer?.rating || 1200,
            avatar: doc.blackPlayer?.avatar || null,
            isOnline: !!doc.blackPlayer?.isOnline,
          }
        : null,
    };

    if (isParticipant || doc.status === 'finished') {
      publicGame.moves = Array.isArray(doc.moves)
        ? doc.moves.map((m) => ({
            san: m.san,
            lan: m.lan,
            timeSpent: m.timeSpent,
            whiteTime: m.whiteTime,
            blackTime: m.blackTime,
            piece: m.piece,
            captured: m.captured || null,
            flags: m.flags || null,
            promotion: m.promotion || null,
            fenAfter: m.fenAfter,
          }))
        : [];
    } else {
      const slice = Array.isArray(doc.moves) ? doc.moves.slice(Math.max(0, doc.moves.length - 3)) : [];
      publicGame.moves = slice.map((m) => ({ san: m.san, lan: m.lan }));
    }

    return NextResponse.json({ ok: true, game: publicGame }, { status: 200 });
  } catch (e) {
    console.error('[API /api/games/:id] GET error:', e.message);
    return NextResponse.json(
      { ok: false, error: 'Internal error. Please try again.' },
      { status: 500 }
    );
  }
}
