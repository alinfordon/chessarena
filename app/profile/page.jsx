import Link from 'next/link';
import {
  User,
  Swords,
  Trophy,
  Calendar,
  Crown,
  Target,
  Zap,
  Award,
  Pencil,
  Settings,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import ShareButton from './ShareButton';
import ProfileSettings from './ProfileSettings';
import { getCurrentUser } from '@/lib/auth';
import { isAdminUser } from '@/lib/admin';
import dbConnect from '@/lib/mongodb';
import Game from '@/models/Game';
import mongoose from 'mongoose';

const ACHIEVEMENTS_DEF = [
  { id: 'first_win', name: 'First Win', desc: 'Win your first match', icon: Trophy, color: 'bg-amber-500', check: (u) => (u.gamesWon || 0) >= 1 },
  { id: 'rising_star', name: 'Rising Star', desc: 'Reach 1500 overall rating', icon: Zap, color: 'bg-brand-500', check: (u) => (u.rating || 0) >= 1500 },
  { id: 'g100', name: '100 Games', desc: 'Play 100 matches', icon: Swords, color: 'bg-emerald-500', check: (u) => (u.gamesPlayed || 0) >= 100 },
  { id: 'win_streak_10', name: 'Win Streak', desc: 'Win 10 games in a row (tracked)', icon: Crown, color: 'bg-purple-500', check: () => false },
  { id: 'tournament_hero', name: 'Tournament Hero', desc: 'Top 3 in a tournament', icon: Award, color: 'bg-rose-500', check: () => false },
  { id: 'blitz100wins', name: 'Blitz Master', desc: '100 wins total', icon: Target, color: 'bg-sky-500', check: (u) => (u.gamesWon || 0) >= 100 },
  { id: 'blitz_1800', name: 'Blitz Star', desc: 'Reach 1800 blitz', icon: Zap, color: 'bg-orange-500', check: (u) => (u.blitzRating || 0) >= 1800 },
  { id: 'rapid_2000', name: 'Rapid Expert', desc: 'Reach 2000 rapid', icon: Swords, color: 'bg-indigo-500', check: (u) => (u.rapidRating || 0) >= 2000 },
  { id: 'draw_100', name: 'Tie Master', desc: '100 draws', icon: Target, color: 'bg-amber-600', check: (u) => (u.gamesDraw || 0) >= 100 },
  { id: 'classical_2200', name: 'Classical Master', desc: 'Reach 2200 classical', icon: Trophy, color: 'bg-emerald-600', check: (u) => (u.classicalRating || 0) >= 2200 },
  { id: 'g_500', name: 'Loyal Player', desc: '500 games played', icon: Award, color: 'bg-pink-500', check: (u) => (u.gamesPlayed || 0) >= 500 },
  { id: 'winrate_70', name: 'Dominator', desc: '70%+ win rate over 100 games', icon: Crown, color: 'bg-red-500', check: (u) => u.gamesPlayed >= 100 && Math.round((u.gamesWon + u.gamesDraw * 0.5) / u.gamesPlayed * 100) >= 70 },
];

export const metadata = {
  title: 'Profile · Chess Arena',
  description: 'Your profile, stats, ratings, achievements and game history',
  robots: 'noindex,nofollow',
};

async function getRecentGames(userId) {
  await dbConnect();
  const _id = new mongoose.Types.ObjectId(userId);
  const total = await Game.countDocuments({
    $or: [{ whitePlayer: _id }, { blackPlayer: _id }],
    status: { $in: ['finished', 'aborted'] },
  });
  const games = await Game.find({
    $or: [{ whitePlayer: _id }, { blackPlayer: _id }],
    status: { $in: ['finished', 'aborted'] },
  })
    .sort({ finishedAt: -1, createdAt: -1 })
    .limit(30)
    .select(
      'gameId whitePlayer blackPlayer whiteUsername blackUsername whiteRating blackRating ratingCategory initialTime increment status result termination moves createdAt finishedAt'
    )
    .lean();

  const uidStr = userId.toString();
  return {
    total,
    games: games.map((g) => {
      const isWhite = g.whitePlayer?.toString() === uidStr;
      const opponent = isWhite
        ? { username: g.blackUsername, rating: g.blackRating }
        : { username: g.whiteUsername, rating: g.whiteRating };
      let myResult = null;
      if (g.result === 'draw') myResult = 'draw';
      else if (g.result && isWhite && g.result === 'white') myResult = 'win';
      else if (g.result && !isWhite && g.result === 'black') myResult = 'win';
      else if (g.result) myResult = 'loss';

      const tc =
        g.initialTime >= 60
          ? `${Math.floor(g.initialTime / 60)}${g.increment ? `+${g.increment}` : ''}`
          : `${g.initialTime}s${g.increment ? `+${g.increment}` : ''}`;

      let opening = null;
      if (g.moves && g.moves.length >= 2) {
        const f = g.moves[0].san || '';
        const s = g.moves[1]?.san || '';
        if (f.startsWith('e4')) opening = s.startsWith('c5') ? 'Sicilian Defense' : "King's Pawn";
        else if (f.startsWith('d4')) opening = s.startsWith('d5') ? "Queen's Gambit" : 'Indian Defense';
        else if (f.startsWith('Nf3')) opening = 'Réti Opening';
        else if (f.startsWith('c4')) opening = 'English Opening';
        else opening = 'Unknown';
      }
      return {
        gameId: g.gameId,
        result: myResult,
        opponent,
        tc,
        moves: g.moves?.length || 0,
        finishedAt: g.finishedAt || g.createdAt,
        opening,
      };
    }),
  };
}

function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  if (d2 < 7) return `${d2}d ago`;
  return new Date(d).toLocaleDateString();
}

const PROFILE_TABS = ['overview', 'ratings', 'achievements', 'history', 'settings'];

export default async function ProfilePage({ searchParams }) {
  const sp = await searchParams;
  const tabParam = Array.isArray(sp?.tab) ? sp.tab[0] : sp?.tab;
  const initialTab = PROFILE_TABS.includes(tabParam) ? tabParam : 'overview';
  let user = null;
  try {
    user = await getCurrentUser();
    if (!user) {
      return (
        <div className="flex-1 px-4 py-20 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-10 space-y-5 text-center">
              <div className="h-16 w-16 rounded-2xl gradient-bg mx-auto flex items-center justify-center shadow-xl">
                <User size={28} className="text-white" />
              </div>
              <h2 className="text-2xl font-black">Sign in</h2>
              <p className="text-slate-600 dark:text-slate-400">You need to be signed in to view your profile.</p>
              <div className="flex gap-3 justify-center">
                <Button href="/login">Login</Button>
                <Button variant="secondary" href="/register">Sign up</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  } catch (e) {
    console.warn('[Profile] Auth error:', e.message);
    return (
      <div className="flex-1 p-10 text-center text-red-600">
        Could not load profile. Please try again.
      </div>
    );
  }

  const displayUser = user.toObject ? user.toObject() : user;
  const winRate = displayUser.gamesPlayed
    ? Math.round(((displayUser.gamesWon + (displayUser.gamesDraw || 0) * 0.5) / displayUser.gamesPlayed) * 100)
    : 0;

  const achievements = ACHIEVEMENTS_DEF.map((a) => ({ ...a, unlocked: a.check(displayUser) }));

  let recent = { total: 0, games: [] };
  try {
    recent = await getRecentGames(user._id);
  } catch (e) {
    console.warn('[Profile] Recent games error:', e);
  }

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl w-full py-8 lg:py-12 animate-fade-in">
      <Card className="overflow-hidden mb-8 relative">
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-br from-brand-500 via-purple-500 to-pink-500" />
        <CardContent className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 pt-20 sm:pt-16">
            <Avatar src={displayUser.avatar} alt={displayUser.username} size="2xl" status={displayUser.isOnline ? 'online' : 'offline'} ring />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {displayUser.username}
                </h1>
                <Badge variant="primary" size="md">Rating {displayUser.rating}</Badge>
                {isAdminUser(displayUser) && <Badge variant="gold" size="md">Admin</Badge>}
                {displayUser.isOnline && <Badge variant="success" size="md" dot>Online</Badge>}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Member since {new Date(displayUser.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" size="sm" href="/profile?tab=settings">
                <Pencil size={14} /> Edit profile
              </Button>
              <ShareButton username={displayUser.username} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-8">
            {[
              { icon: Swords, label: 'Games', value: displayUser.gamesPlayed || 0 },
              { icon: Trophy, label: 'Wins', value: displayUser.gamesWon || 0, tone: 'text-emerald-500' },
              { icon: Target, label: 'Draws', value: displayUser.gamesDraw || 0, tone: 'text-amber-500' },
              { icon: Award, label: 'Win Rate', value: `${winRate}%`, tone: 'text-brand-500' },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50">
                <s.icon size={18} className={s.tone || 'text-slate-500'} />
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{s.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs key={initialTab} defaultValue={initialTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview"><Crown size={14} /> Overview</TabsTrigger>
          <TabsTrigger value="ratings"><Award size={14} /> Ratings</TabsTrigger>
          <TabsTrigger value="achievements"><Trophy size={14} /> Achievements ({achievements.filter(a=>a.unlocked).length}/{achievements.length})</TabsTrigger>
          <TabsTrigger value="history"><Swords size={14} /> History ({recent.total})</TabsTrigger>
          <TabsTrigger value="settings"><Settings size={14} /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2.5">
                      <Swords size={18} className="text-brand-500" /> Recent Games
                    </CardTitle>
                    <CardDescription>Last 10 games · Click to review</CardDescription>
                  </div>
                  {recent.total > 10 && (
                    <Button variant="ghost" size="sm" href="/profile?tab=history">
                      View all
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                {recent.games.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 dark:text-slate-400 space-y-2">
                    <Swords size={32} className="mx-auto opacity-40" />
                    <p>You haven&apos;t played any games yet.</p>
                    <Button href="/play">Play now</Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {recent.games.slice(0, 10).map((g) => {
                      const resultColor =
                        g.result === 'win'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          : g.result === 'loss'
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300'
                          : g.result === 'draw'
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-700/40 text-slate-700 dark:text-slate-300';
                      const badgeVariant = g.result === 'win' ? 'success' : g.result === 'loss' ? 'danger' : g.result === 'draw' ? 'warning' : 'default';
                      return (
                        <Link
                          key={g.gameId}
                          href={`/game/${g.gameId}`}
                          className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold uppercase ${resultColor}`}>
                            {g.result || '?'}
                          </div>
                          <Avatar size="md" alt={g.opponent?.username || 'opp'} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                vs {g.opponent?.username || 'opponent'}
                              </span>
                              <Badge variant="primary" size="sm">{g.tc}</Badge>
                              <Badge variant={badgeVariant} size="sm">{g.moves} moves</Badge>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {g.opening || '—'} · Opp {g.opponent?.rating || '—'}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{timeAgo(g.finishedAt)}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Win Rate</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{winRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full gradient-bg" style={{ width: `${winRate}%` }} />
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  {[
                    ['Blitz Rating', displayUser.blitzRating, 'text-amber-500'],
                    ['Rapid Rating', displayUser.rapidRating, 'text-brand-500'],
                    ['Classical Rating', displayUser.classicalRating, 'text-purple-500'],
                  ].map(([label, val, color], i) => (
                    <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/40">
                      <span className="text-slate-600 dark:text-slate-400 text-xs">{label}</span>
                      <span className={`font-black ${color}`}>{val}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between items-center gap-2">
                    <Calendar size={12} />
                    <span>Member since</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(displayUser.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" href="/play" className="w-full">
                  <Swords size={14} /> Play Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ratings">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Overall', rating: displayUser.rating, icon: Crown, color: 'from-amber-400 to-amber-600' },
                  { label: 'Blitz', rating: displayUser.blitzRating, icon: Zap, color: 'from-orange-400 to-red-500' },
                  { label: 'Rapid', rating: displayUser.rapidRating, icon: Swords, color: 'from-brand-400 to-brand-600' },
                  { label: 'Classical', rating: displayUser.classicalRating, icon: Award, color: 'from-purple-400 to-purple-600' },
                  { label: 'Games Played', rating: displayUser.gamesPlayed || 0, icon: Target, color: 'from-emerald-400 to-emerald-600' },
                  { label: 'Win Rate', rating: `${winRate}%`, icon: Trophy, color: 'from-pink-400 to-rose-600' },
                ].map((s, i) => (
                  <div key={i} className={`rounded-2xl p-5 bg-gradient-to-br ${s.color} text-white shadow-xl`}>
                    <s.icon size={20} className="opacity-90 mb-3" />
                    <div className="text-3xl font-black">{s.rating}</div>
                    <div className="text-sm opacity-85">{s.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {achievements.map((a) => (
              <Card key={a.id} hover>
                <CardContent className="text-center p-5 space-y-2">
                  <div className={`mx-auto h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg ${a.color} ${!a.unlocked ? 'opacity-30 grayscale' : ''}`}>
                    <a.icon size={26} className="text-white" />
                  </div>
                  <h4 className={`font-bold text-sm ${!a.unlocked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                    {a.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    {a.desc}
                  </p>
                  <Badge variant={a.unlocked ? 'success' : 'default'} size="sm">
                    {a.unlocked ? 'Unlocked' : 'Locked'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Game History</CardTitle>
              <CardDescription>Last 30 games — click to review the moves</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              {recent.games.length === 0 ? (
                <div className="p-10 text-center text-slate-500 dark:text-slate-400">
                  No games to show.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recent.games.map((g) => (
                    <Link
                      key={g.gameId}
                      href={`/game/${g.gameId}`}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <Avatar size="md" alt={g.opponent?.username || 'opp'} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          vs {g.opponent?.username || 'opponent'}{' '}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            ({g.opponent?.rating || '—'})
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {g.opening || '—'} · {g.moves} moves · {timeAgo(g.finishedAt)}
                        </div>
                      </div>
                      <Badge variant="primary" size="sm">{g.tc}</Badge>
                      <Badge
                        variant={
                          g.result === 'win' ? 'success' : g.result === 'loss' ? 'danger' : g.result === 'draw' ? 'warning' : 'default'
                        }
                        size="md"
                        className="uppercase"
                      >
                        {g.result || '—'}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <ProfileSettings
            username={displayUser.username}
            email={displayUser.email || ''}
            avatar={displayUser.avatar || ''}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
