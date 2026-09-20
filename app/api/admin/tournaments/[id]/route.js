import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import { requireAdmin } from '@/lib/admin';
import { cacheDelPattern } from '@/lib/cache';
import { sanitizeText } from '@/utils/validation';

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

    if (typeof body.official === 'boolean') t.official = body.official;
    if (body.status && ['registration', 'live', 'finished', 'cancelled'].includes(body.status)) {
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

    await t.save();
    try {
      await cacheDelPattern('tournaments:list:');
    } catch {}

    return NextResponse.json({
      ok: true,
      tournament: { ...t.toObject(), _id: String(t._id) },
    });
  } catch (e) {
    console.error('[API][admin/tournaments/:id]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
