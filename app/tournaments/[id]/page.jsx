import { ArrowLeft, AlertCircle } from 'lucide-react';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import TournamentPlayer from '@/models/TournamentPlayer';
import Game from '@/models/Game';
import User from '@/models/User';
import { getCurrentUser } from '@/lib/auth';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import TournamentDetailClient from '@/components/tournaments/TournamentDetailClient';

function isValidMongoId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

export const dynamic = 'force-dynamic';

const TYPE_META = {
  arena: { label: 'Arena' },
  swiss: { label: 'Swiss' },
  round_robin: { label: 'Round Robin' },
  single_elimination: { label: 'Single Elim.' },
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  if (!isValidMongoId(id)) {
    return { title: 'Tournament', robots: { index: false, follow: true } };
  }
  try {
    await dbConnect();
    const t = await Tournament.findById(id).select('name type status').lean();
    if (!t) return { title: 'Tournament not found' };
    const typeLabel = TYPE_META[t.type]?.label || 'Tournament';
    return {
      title: t.name || 'Tournament',
      description: `${typeLabel} chess tournament on Chess Arena${t.status ? ` · ${t.status}` : ''}. Built by Sky Game & Robotics Development.`,
    };
  } catch {
    return { title: 'Tournament' };
  }
}

export default async function TournamentDetailPage({ params }) {
  const user = await getCurrentUser().catch(() => null);
  const { id } = await params;
  let error = null;
  let t = null;
  let players = [];
  let pairings = [];
  let winners = [];
  let curPlayersCount = 0;
  let userRegistered = false;
  let canRegister = false;
  let userRating = 1200;

  try {
    await dbConnect();
    if (!isValidMongoId(id)) throw new Error('Invalid tournament ID');
    t = await Tournament.findById(id).populate('createdBy', 'username avatar').lean();
    if (!t) throw new Error('Tournament not found');

    const ratedCat = t.timeControl?.initialTime
      ? (t.timeControl.initialTime < 180 ? 'blitzRating' : t.timeControl.initialTime < 600 ? 'rapidRating' : 'classicalRating')
      : 'rapidRating';

    players = await TournamentPlayer.find({ tournamentId: t._id })
      .sort({ score: -1, buchholz: -1, sonnebornBerger: -1, rating: -1 })
      .select('userId username rating score wins losses draws gamesPlayed buchholz status tiebreak seed')
      .lean();
    players = players.map((p, i) => ({ ...p, rank: i + 1, _id: String(p._id), userId: String(p.userId) }));
    curPlayersCount = players.length;

    pairings = await Game.find({ tournamentId: String(t._id) })
      .sort({ createdAt: -1 })
      .select('gameId whitePlayer blackPlayer whiteUsername blackUsername whiteRating blackRating status result moves startedAt finishedAt')
      .limit(100)
      .lean();
    pairings = pairings.map((g) => ({
      gameId: g.gameId,
      _id: String(g._id),
      whitePlayer: g.whitePlayer ? String(g.whitePlayer) : null,
      blackPlayer: g.blackPlayer ? String(g.blackPlayer) : null,
      whiteUsername: g.whiteUsername,
      blackUsername: g.blackUsername,
      whiteRating: g.whiteRating,
      blackRating: g.blackRating,
      status: g.status,
      result: g.result,
      startedAt: g.startedAt,
      finishedAt: g.finishedAt,
      movesCount: (g.moves || []).length,
    }));

    if (t.winners?.length) {
      const wDocs = await User.find({ _id: { $in: t.winners } }).select('username rating avatar').lean();
      const order = new Map(t.winners.map((w, i) => [String(w), i]));
      wDocs.sort((a, b) => (order.get(String(a._id)) || 0) - (order.get(String(b._id)) || 0));
      winners = wDocs.map((w) => ({ ...w, _id: String(w._id) }));
    }

    if (t.createdBy) t.createdBy = { ...t.createdBy, _id: String(t.createdBy._id) };

    if (user) {
      const uid = String(user._id);
      userRegistered = players.some((p) => p.userId === uid);
      userRating = user[ratedCat] || user.rating || 1200;
      const inRatingRange = userRating >= (t.minRating ?? 0) && userRating <= (t.maxRating ?? 3000);
      canRegister = !!user && t.status === 'registration' && !userRegistered && curPlayersCount < (t.maxPlayers ?? 16) && inRatingRange;
    }
  } catch (e) {
    console.error('[TournamentDetail] DB error:', e?.message || e);
    error = e?.message || 'Could not load tournament';
  }

  if (error || !t) {
    return (
      <div className="flex-1 px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl w-full py-8 lg:py-12 animate-fade-in">
        <Button variant="ghost" size="sm" href="/tournaments" className="mb-6">
          <ArrowLeft size={16} /> Back to Tournaments
        </Button>
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <AlertCircle size={40} className="mx-auto text-red-500" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Could not load
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{error || 'Tournament not found'}</p>
            <Button href="/tournaments">
              Back to tournament list
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initialData = JSON.stringify({
    tournament: { ...t, _id: String(t._id), createdBy: t.createdBy ? { ...t.createdBy, _id: String(t.createdBy._id) } : null },
    players,
    pairings,
    winners,
    curPlayersCount,
    userRegistered,
    canRegister,
    userRating: user ? userRating : null,
    userId: user ? String(user._id) : null,
  }).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl w-full py-8 lg:py-12 animate-fade-in">
      <Button variant="ghost" size="sm" href="/tournaments" className="mb-6">
        <ArrowLeft size={16} /> Back to Tournaments
      </Button>
      <TournamentDetailClient initialDataStr={initialData} />
    </div>
  );
}
