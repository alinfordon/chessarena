import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import TournamentPlayer from '@/models/TournamentPlayer';
import Game from '@/models/Game';
import { requireAdmin } from '@/lib/admin';
import { cacheDelPattern } from '@/lib/cache';
import { sanitizeText, validateTimeControl } from '@/utils/validation';

const TYPES = ['arena', 'swiss', 'round_robin', 'single_elimination'];
const STATUSES = ['registration', 'live', 'finished', 'cancelled'];

function clampPts(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1000, Math.round(v * 100) / 100));
}

function applyRounds(t) {
  if (t.type === 'round_robin' && t.maxPlayers > 0) {
    t.rounds = t.maxPlayers % 2 === 0 ? t.maxPlayers - 1 : t.maxPlayers;
  } else if (t.type === 'swiss') {
    t.rounds = Math.ceil(Math.log2(t.maxPlayers || 16) * 1.5);
  } else if (t.type === 'single_elimination') {
    t.rounds = Math.ceil(Math.log2(t.maxPlayers || 16));
  }
}

async function invalidateTournamentCache() {
  try {
    await cacheDelPattern('tournaments:list:');
  } catch {}
}

export async function PATCH(req, ctx) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await ctx.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid tournament ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    await dbConnect();
    const t = await Tournament.findById(id);
    if (!t) {
      return NextResponse.json({ ok: false, error: 'Tournament not found' }, { status: 404 });
    }

    let structureChanged = false;

    if (typeof body.official === 'boolean') t.official = body.official;
    if (body.status && STATUSES.includes(body.status)) {
      t.status = body.status;
    }
    if (typeof body.name === 'string' && body.name.trim().length >= 3) {
      t.name = sanitizeText(body.name, 100);
    }
    if (typeof body.description === 'string') {
      t.description = sanitizeText(body.description, 1000);
    }
    if (typeof body.prizePool === 'string') {
      t.prizePool = sanitizeText(body.prizePool, 200);
    }
    if (body.type && TYPES.includes(body.type) && body.type !== t.type) {
      t.type = body.type;
      structureChanged = true;
    }
    if (body.maxPlayers != null) {
      const maxPlayers = parseInt(body.maxPlayers, 10);
      if (!Number.isFinite(maxPlayers) || maxPlayers < 2 || maxPlayers > 512) {
        return NextResponse.json({ ok: false, error: 'Players must be between 2 and 512' }, { status: 400 });
      }
      const enrolled = t.currentPlayers || 0;
      if (maxPlayers < enrolled) {
        return NextResponse.json(
          { ok: false, error: `Max players cannot be below ${enrolled} already registered` },
          { status: 400 }
        );
      }
      if (maxPlayers !== t.maxPlayers) {
        t.maxPlayers = maxPlayers;
        structureChanged = true;
      }
    }
    if (body.startAt) {
      const startAt = new Date(body.startAt);
      if (Number.isNaN(startAt.getTime())) {
        return NextResponse.json({ ok: false, error: 'Invalid start date' }, { status: 400 });
      }
      t.startAt = startAt;
    }
    if (body.timeControl) {
      const initialTime = parseInt(body.timeControl.initialTime, 10);
      const increment = parseInt(body.timeControl.increment, 10) || 0;
      const tcErr = validateTimeControl(initialTime, increment);
      if (tcErr.length) {
        return NextResponse.json({ ok: false, error: tcErr[0] }, { status: 400 });
      }
      t.timeControl = {
        initialTime,
        increment,
        label: sanitizeText(String(body.timeControl.label || `${Math.floor(initialTime / 60)}+${increment}`), 40),
      };
    }
    if (body.scoring && typeof body.scoring === 'object') {
      t.scoring = {
        win: clampPts(body.scoring.win, t.scoring?.win ?? 2),
        draw: clampPts(body.scoring.draw, t.scoring?.draw ?? 1),
        loss: clampPts(body.scoring.loss, t.scoring?.loss ?? 0),
      };
    }
    if (body.prizes && typeof body.prizes === 'object') {
      t.prizes = {
        first: clampPts(body.prizes.first, t.prizes?.first ?? 0),
        second: clampPts(body.prizes.second, t.prizes?.second ?? 0),
        third: clampPts(body.prizes.third, t.prizes?.third ?? 0),
      };
    }

    if (structureChanged && t.status === 'registration') {
      applyRounds(t);
    }

    await t.save();
    await invalidateTournamentCache();

    return NextResponse.json({
      ok: true,
      tournament: { ...t.toObject(), _id: String(t._id) },
    });
  } catch (e) {
    console.error('[API][admin/tournaments/:id]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await ctx.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid tournament ID' }, { status: 400 });
    }

    await dbConnect();
    const t = await Tournament.findById(id);
    if (!t) {
      return NextResponse.json({ ok: false, error: 'Tournament not found' }, { status: 404 });
    }

    await Promise.all([
      TournamentPlayer.deleteMany({ tournamentId: t._id }),
      Game.updateMany(
        {
          $or: [{ tournamentId: String(t._id) }, { tournamentId: t._id }],
          status: { $in: ['waiting', 'playing'] },
        },
        { $set: { status: 'aborted', termination: 'aborted', finishedAt: new Date() } }
      ),
    ]);
    await Tournament.deleteOne({ _id: t._id });
    await invalidateTournamentCache();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[API][admin/tournaments/:id] DELETE', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
