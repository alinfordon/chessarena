import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('query') || '').trim().slice(0, 32);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

    if (!q || q.length < 2) {
      return NextResponse.json({ ok: true, users: [] });
    }

    await dbConnect();
    const users = await User.find({
      username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      _id: { $ne: user._id },
    })
      .select('username avatar rating blitzRating rapidRating classicalRating isOnline')
      .limit(limit)
      .lean();

    return NextResponse.json({ ok: true, users });
  } catch (e) {
    console.error('[API][users/search] Error:', e);
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
