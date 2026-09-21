import Link from 'next/link';
import { ArrowLeft, Trophy, Users, Clock, Calendar, Crown, Target, Users2, AlertCircle } from 'lucide-react';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import TournamentPlayer from '@/models/TournamentPlayer';
import Game from '@/models/Game';
import User from '@/models/User';
import { getCurrentUser } from '@/lib/auth';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import TournamentDetailClient, { useTDC } from '@/components/tournaments/TournamentDetailClient';

function isValidMongoId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

export const dynamic = 'force-dynamic';

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

const TYPE_META = {
  arena: { label: 'Arena' },
  swiss: { label: 'Swiss' },
  round_robin: { label: 'Round Robin' },
  single_elimination: { label: 'Single Elim.' },
};

function tcLabel(tc) {
  if (!tc) return '—';
  const it = Math.floor(tc.initialTime || 0);
  const inc = tc.increment || 0;
  const mm = Math.floor(it / 60);
  const ss = it % 60;
  const base = ss > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : `${mm}`;
  return inc ? `${base}+${inc}` : base;
}

function prizeLabel(t) {
  const a = Number(t?.prizes?.first) || 0;
  const b = Number(t?.prizes?.second) || 0;
  const c = Number(t?.prizes?.third) || 0;
  if (a || b || c) return `${a} / ${b} / ${c} pts`;
  return t?.prizePool || '—';
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  } catch { return '—'; }
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
      ...g,
      _id: String(g._id),
      whitePlayer: g.whitePlayer ? String(g.whitePlayer) : null,
      blackPlayer: g.blackPlayer ? String(g.blackPlayer) : null,
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

  const stMeta = (t) => {
    if (!t) return { text: '—', variant: 'default', dot: false };
    const s = t.status;
    if (t.status === 'live') return { text: 'LIVE', variant: 'danger', dot: true };
    if (t.status === 'registration') return { text: 'Registration Open', variant: 'success', dot: true };
    if (t.status === 'finished') return { text: 'Finished', variant: 'default', dot: false };
    if (t.status === 'cancelled') return { text: 'Cancelled', variant: 'danger', dot: false };
    return { text: t.status, variant: 'default', dot: false };
  };

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

  const typeMeta = TYPE_META[t.type] || TYPE_META.arena;
  const st = stMeta(t);

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

      <TournamentDetailClient initialDataStr={initialData}>
        {({ status, registerBtn, unregisterBtn, socketBadge, winnersLive }) => (
          <>
            <Card className="mb-8 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1.5 gradient-bg" />
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <Badge variant={st.variant} size="md" dot={st.dot}>{st.text}</Badge>
                      <Badge variant="primary" size="md">{typeMeta.label}</Badge>
                      <Badge variant="warning" size="md">{tcLabel(t.timeControl)}</Badge>
                      {t.official && <Badge variant="gold" size="md">Official</Badge>}
                      {socketBadge}
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
                      {t.name}
                    </h1>
                    {t.description && (
                      <p className="text-slate-600 dark:text-slate-400 max-w-xl">{t.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    {status === 'registration'
                      ? (userRegistered ? unregisterBtn : registerBtn)
                      : status === 'live'
                        ? (
                          <Button size="lg" className="w-full md:min-w-[200px]" variant="primary" disabled>
                            <Trophy size={18} /> In progress
                          </Button>
                        )
                        : (
                          <Button size="lg" className="w-full md:min-w-[200px]" variant="secondary" disabled>
                            <Crown size={18} /> Tournament closed
                          </Button>
                        )
                    }
                    <Button variant="secondary" size="md" className="w-full md:min-w-[200px]">
                      Share Tournament
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-200 dark:border-slate-700/60">
                  {[
                    { icon: Users, label: 'Players', value: `${curPlayersCount} / ${t.maxPlayers || 16}` },
                    { icon: Clock, label: 'Time Control', value: tcLabel(t.timeControl) },
                    { icon: Calendar, label: 'Starts', value: formatDate(t.startAt) },
                    { icon: Crown, label: 'Prizes', value: prizeLabel(t) },
                  ].map((s, i) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
                      <s.icon size={18} className="text-brand-500 mb-2" />
                      <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                      <div className="font-bold text-lg text-slate-900 dark:text-slate-100">{s.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {t.status === 'finished' && (winnersLive?.length || winners.length) && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2.5">
                    <Crown size={18} className="text-amber-500" />
                    Winners
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {(winnersLive?.length ? winnersLive : winners).map((w, i) => (
                      <div key={w._id} className={`p-5 rounded-2xl border text-center ${
                        i === 0
                          ? 'bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 border-amber-200 dark:border-amber-900/60'
                          : i === 1
                            ? 'bg-gradient-to-b from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700'
                            : 'bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/20 dark:to-slate-900 border-orange-200 dark:border-orange-900/50'
                      }`}>
                        <div className="text-3xl mb-2">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                        </div>
                        <Avatar src={w.avatar} alt={w.username} size="lg" className="mx-auto mb-2 ring-4 ring-white dark:ring-slate-900" />
                        <div className="font-bold text-slate-900 dark:text-slate-100">{w.username}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Rating: {w.rating || 1200}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <StandingsCard />
              <div className="space-y-6">
                <PairingsCard />
                <FormatCard t={t} />
                <PrizesCard t={t} />
              </div>
            </div>
          </>
        )}
      </TournamentDetailClient>
    </div>
  );
}

function StandingsCard() {
  const ctx = useTDC();
  const players = ctx.players;
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Users2 size={18} className="text-brand-500" />
          Live Standings
        </CardTitle>
        <CardDescription>{players.length} registered players — updated in real time</CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        {players.length === 0 ? (
          <div className="p-8 text-center">
            <Users size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No players registered yet. Be the first!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-right px-4 py-3">Rating</th>
                  <th className="text-right px-4 py-3">Scor</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">V/D/E</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Buch.</th>
                  <th className="text-right px-4 py-3">Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {players.map((p) => (
                  <tr key={p.userId || p._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : 'default'
                        }
                        size="sm"
                      >
                        #{p.rank}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={p.avatar} alt={p.username} size="sm" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {p.username || 'Unknown'}
                          </div>
                          {p.status === 'eliminated' && (
                            <Badge variant="danger" size="sm">Eliminated</Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{p.rating}</td>
                    <td className="text-right px-4 py-3">
                      <span className="font-bold text-brand-600 dark:text-brand-400">{p.score}</span>
                    </td>
                    <td className="text-right px-4 py-3 text-xs text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                      {p.wins}/{p.draws || 0}/{p.losses || 0}
                    </td>
                    <td className="text-right px-4 py-3 text-xs text-slate-600 dark:text-slate-400 hidden md:table-cell">
                      {p.buchholz || 0}
                    </td>
                    <td className="text-right px-4 py-3 text-slate-600 dark:text-slate-400">{p.gamesPlayed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PairingsCard() {
  const ctx = useTDC();
  const pairings = ctx.pairings;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Target size={18} className="text-amber-500" />
          Matches
        </CardTitle>
        <CardDescription>{pairings.length} recorded matches</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {pairings.length === 0 ? (
          <div className="p-4 text-center">
            <Target size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No matches yet. Start the tournament to see pairings.
            </p>
          </div>
        ) : (
          pairings.map((g) => (
            <Link
              key={g.gameId}
              href={`/game/${g.gameId}`}
              className="block p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <Badge
                  size="sm"
                  variant={
                    g.status === 'playing' ? 'success' : g.status === 'finished' ? 'default' : 'warning'
                  }
                >
                  {g.status === 'playing' ? 'LIVE' : g.status === 'finished' ? 'Finished' : 'Waiting'}
                </Badge>
                {g.result && (
                  <Badge
                    size="sm"
                    variant={
                      g.result === 'white' ? 'success' : g.result === 'black' ? 'success' : 'warning'
                    }
                  >
                    {g.result === 'white' ? '1-0 White' : g.result === 'black' ? '0-1 Black' : '½-½'}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs sm:text-sm">
                <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                  {g.whiteUsername || 'White'} <span className="text-slate-400">({g.whiteRating || 1200})</span>
                </div>
                <span className="text-slate-400 text-[10px]">vs</span>
                <div className="truncate font-semibold text-slate-900 dark:text-slate-100 text-right">
                  <span className="text-slate-400">({g.blackRating || 1200})</span> {g.blackUsername || 'Black'}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{g.movesCount || 0} moves</span>
                <span className="group-hover:text-brand-600 dark:group-hover:text-brand-400 font-semibold">
                  View game →
                </span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function FormatCard({ t }) {
  const rounds = t.rounds || 0;
  const hours = t.durationMs ? Math.round(t.durationMs / 3_600_000) : '—';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Target size={18} className="text-amber-500" />
          Format
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {[
          { label: 'Type', value: (TYPE_META[t.type] || TYPE_META.arena).label },
          { label: 'Rounds', value: rounds || '—' },
          { label: 'Duration', value: typeof hours === 'number' ? `${hours}h` : hours },
          { label: 'Min. Rating', value: t.minRating ?? 0 },
          { label: 'Max. Rating', value: t.maxRating ?? 3000 },
          { label: 'Scoring', value: `${t.scoring?.win ?? 2} / ${t.scoring?.draw ?? 1} / ${t.scoring?.loss ?? 0}` },
        ].map((r, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{r.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PrizesCard({ t }) {
  const rows = [
    { rank: 1, pts: Number(t.prizes?.first) || 0, fallback: 'Glory + Trophy Badge', color: 'gold' },
    { rank: 2, pts: Number(t.prizes?.second) || 0, fallback: 'Silver Badge', color: 'silver' },
    { rank: 3, pts: Number(t.prizes?.third) || 0, fallback: 'Bronze Badge', color: 'bronze' },
  ];
  const hasPts = rows.some((p) => p.pts > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Crown size={18} className="text-amber-500" />
          Prizes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {t.prizePool ? (
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
            <div className="text-xs text-amber-600 dark:text-amber-400">Prize note</div>
            <div className="font-bold text-amber-800 dark:text-amber-200 text-lg">{t.prizePool}</div>
          </div>
        ) : null}
        {rows.map((p) => (
          <div key={p.rank} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
            <Badge variant={p.color} size="lg">#{p.rank}</Badge>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {hasPts ? `${p.pts} points` : p.fallback}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
