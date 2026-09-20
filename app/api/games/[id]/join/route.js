import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import Game from '@/models/Game';

export async function POST(req, ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }
    await dbConnect();
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ ok: false, error: 'Invalid game id' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const color = ['white', 'black'].includes(body?.color) ? body.color : null;
    const inviteCode = body?.inviteCode ? String(body.inviteCode).trim().toUpperCase() : null;
    const idOf = (value) => {
      if (value == null || value === '') return null;
      if (typeof value === 'object' && value._id) return String(value._id);
      const s = String(value);
      return s === '[object Object]' ? null : s;
    };

    const game = await Game.findOne({ gameId: id }).select(
      'gameId whitePlayer blackPlayer whiteUsername blackUsername whiteRating blackRating ratingCategory isPrivate inviteCode status startedAt initialTime increment'
    );
    if (!game) {
      return NextResponse.json({ ok: false, error: 'Game not found' }, { status: 404 });
    }
    if (game.isPrivate && game.inviteCode) {
      const isOwner =
        idOf(user._id) === idOf(game.whitePlayer) ||
        idOf(user._id) === idOf(game.blackPlayer);
      if (!isOwner && String(inviteCode) !== String(game.inviteCode)) {
        return NextResponse.json({ ok: false, error: 'Invalid invite code' }, { status: 403 });
      }
    }
    const uid = idOf(user._id);
    if (idOf(game.whitePlayer) !== uid && idOf(game.blackPlayer) !== uid) {
      if (game.status !== 'waiting') {
        return NextResponse.json({ ok: true, spectator: true });
      }
      const ratingField = game.ratingCategory || 'rapidRating';
      const uRating = user[ratingField] || user.rating || 1200;
      const setFields = {};
      const slotEmpty = (slot) => !idOf(slot);

      if (color === 'white' && slotEmpty(game.whitePlayer)) {
        setFields.whitePlayer = user._id;
        setFields.whiteUsername = user.username;
        setFields.whiteRating = uRating;
      } else if (color === 'black' && slotEmpty(game.blackPlayer)) {
        setFields.blackPlayer = user._id;
        setFields.blackUsername = user.username;
        setFields.blackRating = uRating;
      } else {
        if (slotEmpty(game.whitePlayer)) {
          setFields.whitePlayer = user._id;
          setFields.whiteUsername = user.username;
          setFields.whiteRating = uRating;
        } else if (slotEmpty(game.blackPlayer)) {
          setFields.blackPlayer = user._id;
          setFields.blackUsername = user.username;
          setFields.blackRating = uRating;
        } else {
          return NextResponse.json(
            { ok: false, error: 'Game full', spectator: true },
            { status: 409 }
          );
        }
      }
      if (setFields.whitePlayer || setFields.blackPlayer) {
        Object.assign(game, setFields);
      }
      if (idOf(game.whitePlayer) && idOf(game.blackPlayer) && game.status === 'waiting') {
        game.status = 'playing';
        game.startedAt = new Date();
      }
      await game.save();
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
      if (socketUrl) {
        fetch(`${socketUrl}/notify?type=game-sync&gameId=${game.gameId}`, {
          method: 'POST',
        }).catch(() => {});
      }
    }
    return NextResponse.json({
      ok: true,
      gameId: game.gameId,
      status: game.status,
      startedAt: game.startedAt || null,
      spectator:
        idOf(game.whitePlayer) !== uid &&
        idOf(game.blackPlayer) !== uid,
    });
  } catch (e) {
    console.error('[API /api/games/:id/join] error:', e.message);
    return NextResponse.json(
      { ok: false, error: 'Internal error. Please try again.' },
      { status: 500 }
    );
  }
}
