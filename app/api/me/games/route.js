import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Game from '@/models/Game';
import { getCurrentUser } from '@/lib/auth';
import { formatTime } from '@/utils/time';

export async function GET(req) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '50', 10), 200));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const status = searchParams.get('status');

    await dbConnect();
    const uid = user._id;

    const filter = {
      $or: [{ whitePlayer: uid }, { blackPlayer: uid }],
    };
    if (status && ['waiting', 'playing', 'finished', 'aborted'].includes(status)) {
      filter.status = status;
    }

    const [total, games] = await Promise.all([
      Game.countDocuments(filter),
      Game.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select(
          'gameId whitePlayer blackPlayer whiteUsername blackUsername whiteRating blackRating ratingCategory initialTime increment status result termination moves moves.length createdAt startedAt finishedAt isPrivate'
        )
        .lean(),
    ]);

    const userIdStr = uid.toString();
    const mapped = games.map((g) => {
      const isWhite = g.whitePlayer?.toString() === userIdStr;
      const opponent = isWhite
        ? { username: g.blackUsername, rating: g.blackRating }
        : { username: g.whiteUsername, rating: g.whiteRating };
      let myResult = null;
      if (g.result === 'draw') myResult = 'draw';
      else if (g.result && isWhite && g.result === 'white') myResult = 'win';
      else if (g.result && !isWhite && g.result === 'black') myResult = 'win';
      else if (g.result) myResult = 'loss';

      const tcLabel =
        g.initialTime >= 60
          ? `${Math.floor(g.initialTime / 60)}${g.increment ? `+${g.increment}` : ''}`
          : `${g.initialTime}s${g.increment ? `+${g.increment}` : ''}`;

      let opening = null;
      if (g.moves && g.moves.length >= 2) {
        const first = g.moves[0].san || '';
        const second = g.moves[1]?.san || '';
        if (first.startsWith('e4')) opening = second.startsWith('c5') ? 'Sicilian Defense' : "King's Pawn";
        else if (first.startsWith('d4')) opening = second.startsWith('d5') ? "Queen's Gambit" : 'Indian Defense';
        else if (first.startsWith('Nf3')) opening = 'Réti Opening';
        else if (first.startsWith('c4')) opening = 'English Opening';
        else opening = 'Unknown';
      }
      return {
        gameId: g.gameId,
        status: g.status,
        result: myResult,
        termination: g.termination,
        opponent,
        tc: tcLabel,
        ratingCategory: g.ratingCategory,
        moves: g.moves?.length || 0,
        createdAt: g.createdAt,
        finishedAt: g.finishedAt,
        isPrivate: !!g.isPrivate,
        opening,
      };
    });

    return NextResponse.json({ ok: true, games: mapped, total, limit, offset });
  } catch (e) {
    console.error('[API][me/games] Error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
