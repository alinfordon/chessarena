import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import TournamentPlayer from '@/models/TournamentPlayer';
import { getCurrentUser } from '@/lib/auth';
import { isAdminUser } from '@/lib/admin';
import { validateTimeControl } from '@/utils/validation';
import mongoose from 'mongoose';
import { cacheGet, cacheSet, cacheDelPattern } from '@/lib/cache';

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '50', 10), 200));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const cacheKey = `tournaments:list:${status || 'all'}:${limit}:${offset}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const filter = {};
    if (status && ['registration', 'live', 'finished', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    const [total, tournaments] = await Promise.all([
      Tournament.countDocuments(filter),
      Tournament.find(filter)
        .sort({ status: 1, startAt: 1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate({ path: 'createdBy', select: 'username avatar rating' })
        .lean(),
    ]);

    const mapped = await Promise.all(
      tournaments.map(async (t) => {
        const count = await TournamentPlayer.countDocuments({ tournamentId: t._id });
        return {
          ...t,
          currentPlayers: count,
          _id: t._id.toString(),
          createdBy: t.createdBy
            ? { ...t.createdBy, _id: t.createdBy._id.toString() }
            : null,
        };
      })
    );

    const response = { ok: true, tournaments: mapped, total, limit, offset };
    await cacheSet(cacheKey, response, 60);

    return NextResponse.json(response);
  } catch (e) {
    console.error('[API][tournaments] GET Error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const {
      name,
      description = '',
      type = 'arena',
      timeControl,
      maxPlayers = 16,
      minRating = 0,
      maxRating = 3000,
      prizePool = '',
      startAt,
      durationMs = 3600000,
      allowByes = false,
    } = body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return NextResponse.json({ ok: false, error: 'Invalid tournament name (min 3 characters)' }, { status: 400 });
    }
    if (!['arena', 'swiss', 'round_robin', 'single_elimination'].includes(type)) {
      return NextResponse.json({ ok: false, error: 'Invalid tournament type' }, { status: 400 });
    }
    const tcErr = validateTimeControl(timeControl?.initialTime, timeControl?.increment || 0);
    if (tcErr.length) return NextResponse.json({ ok: false, error: tcErr[0] }, { status: 400 });
    if (!startAt || isNaN(new Date(startAt).getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid start date' }, { status: 400 });
    }
    if (maxPlayers < 2 || maxPlayers > 512) {
      return NextResponse.json({ ok: false, error: 'Players must be between 2 and 512' }, { status: 400 });
    }

    const clampPts = (n, fallback) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return fallback;
      return Math.max(0, Math.min(1000, Math.round(v * 100) / 100));
    };
    const scoring = {
      win: clampPts(body.scoring?.win, 2),
      draw: clampPts(body.scoring?.draw, 1),
      loss: clampPts(body.scoring?.loss, 0),
    };
    const prizes = {
      first: clampPts(body.prizes?.first, 0),
      second: clampPts(body.prizes?.second, 0),
      third: clampPts(body.prizes?.third, 0),
    };

    await dbConnect();

    const t = new Tournament({
      name: name.trim().slice(0, 100),
      description: String(description || '').slice(0, 1000),
      type,
      timeControl: {
        initialTime: timeControl.initialTime,
        increment: timeControl.increment || 0,
        label: timeControl.label ||
          `${Math.floor(timeControl.initialTime / 60)}+${timeControl.increment || 0}`,
      },
      maxPlayers,
      currentPlayers: 0,
      minRating: Math.max(0, parseInt(minRating) || 0),
      maxRating: Math.min(4000, parseInt(maxRating) || 3000),
      prizePool: String(prizePool || '').slice(0, 200),
      status: 'registration',
      startAt: new Date(startAt),
      durationMs: parseInt(durationMs) || 3600000,
      createdBy: new mongoose.Types.ObjectId(user._id),
      pairingAlgorithm: 'auto',
      allowByes: !!allowByes,
      official: isAdminUser(user) && body.official === true,
      scoring,
      prizes,
    });
    await t.save();
    try {
      await cacheDelPattern('tournaments:list:');
    } catch {}

    return NextResponse.json({
      ok: true,
      tournament: { ...t.toObject(), _id: t._id.toString(), createdBy: user._id.toString() },
    }, { status: 201 });
  } catch (e) {
    console.error('[API][tournaments] POST Error:', e);
    return NextResponse.json(
      { ok: false, error: e.message || 'Could not create tournament' },
      { status: 500 }
    );
  }
}
