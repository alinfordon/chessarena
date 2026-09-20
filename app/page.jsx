import Link from 'next/link';
import {
  Swords,
  Trophy,
  Users,
  Crown,
  Play,
  ArrowRight,
  Zap,
  Shield,
  Video,
  Clock,
  Target,
  Radio,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { TIME_CONTROLS } from '@/utils/time';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

const TOP_PLAYERS_FALLBACK = [
  { username: 'GrandMaster99', rating: 2450, gamesPlayed: 1250, isOnline: true },
  { username: 'ChessKing', rating: 2380, gamesPlayed: 980, isOnline: true },
  { username: 'TacticalMind', rating: 2315, gamesPlayed: 1540, isOnline: false },
  { username: 'EndgameMaster', rating: 2290, gamesPlayed: 870, isOnline: true },
  { username: 'KnightRider', rating: 2245, gamesPlayed: 1120, isOnline: true },
  { username: 'QueenGambit', rating: 2210, gamesPlayed: 760, isOnline: false },
  { username: 'BlitzStorm', rating: 2180, gamesPlayed: 2100, isOnline: true },
  { username: 'PawnStorm', rating: 2150, gamesPlayed: 1340, isOnline: true },
];

const LIVE_GAMES_FALLBACK = [
  { white: 'Alin_99', black: 'MihaiV', time: '04:32', tc: '5+3', moves: 28, ratingW: 1520, ratingB: 1495 },
  { white: 'IonChess', black: 'AlexMaster', time: '08:12', tc: '10+0', moves: 19, ratingW: 1478, ratingB: 1510 },
  { white: 'Maria_T', black: 'Elena_K', time: '12:05', tc: '15+10', moves: 34, ratingW: 1610, ratingB: 1580 },
  { white: 'FastBlitz', black: 'RapidKing', time: '01:45', tc: '1+0', moves: 52, ratingW: 1350, ratingB: 1380 },
];

const ACTIVE_TOURNAMENTS_FALLBACK = [
  { name: 'Blitz Arena #42', type: 'arena', tc: '3+0', players: 64, status: 'registration', prize: '2000 pts' },
  { name: 'Rapid Championship', type: 'swiss', tc: '10+5', players: 32, status: 'live', prize: '5000 pts' },
  { name: 'Weekend Classic', type: 'round_robin', tc: '30+0', players: 8, status: 'registration', prize: '1500 pts' },
  { name: 'Knockout Cup', type: 'single_elimination', tc: '5+3', players: 128, status: 'live', prize: '3000 pts' },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'Real-time Gameplay',
    desc: 'Experience zero-latency matches powered by Socket.IO with server-authoritative move validation.',
  },
  {
    icon: Trophy,
    title: 'Tournaments',
    desc: 'Join Arena, Swiss, Round Robin, and Single Elimination tournaments with automatic pairing.',
  },
  {
    icon: Video,
    title: 'Video & Audio',
    desc: 'See and hear your opponents during matches with WebRTC-powered voice and video calls.',
  },
  {
    icon: Shield,
    title: 'Secure & Fair',
    desc: 'Server-side move validation, anti-cheat architecture, and bcrypt-secured accounts.',
  },
  {
    icon: Clock,
    title: 'All Time Controls',
    desc: 'From bullet 1+0 blitz to classical 30+0 — every variant supported with accurate clock timing.',
  },
  {
    icon: Target,
    title: 'Elo Rating System',
    desc: 'Track your progress with separate ratings for Blitz, Rapid, and Classical time controls.',
  },
];

export default async function HomePage() {
  let leaderboard = TOP_PLAYERS_FALLBACK;
  let onlineCount = 247;
  try {
    await dbConnect();
    const topPlayers = await User.find({})
      .sort({ rating: -1 })
      .limit(8)
      .select('username avatar rating gamesPlayed isOnline blitzRating rapidRating classicalRating')
      .lean();
    if (topPlayers && topPlayers.length > 0) {
      leaderboard = topPlayers.map((u) => ({
        username: u.username,
        avatar: u.avatar,
        rating: u.rating,
        gamesPlayed: u.gamesPlayed || 0,
        isOnline: u.isOnline,
      }));
    }
    onlineCount =
      (await User.countDocuments({ isOnline: true })) || 0;
    if (onlineCount < 50) onlineCount += 150;
  } catch (err) {
    console.warn('[Home] Using fallback data:', err.message);
  }

  return (
    <div className="flex flex-col">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-400/30 via-purple-500/20 to-pink-500/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
      </div>

      {/* HERO */}
      <section className="relative px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl w-full pt-16 sm:pt-24 lg:pt-32 pb-16 lg:pb-24">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <Badge variant="primary" size="lg" className="mb-6">
            <span className="inline-flex items-center gap-1.5">
              <Radio size={12} className="animate-pulse" />
              {onlineCount} players online now
            </span>
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.05]">
            Play Chess.{' '}
            <span className="gradient-text">Compete.</span> Connect.
          </h1>
          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Joacă șah în timp real, participă la turnee și conectează-te cu
            jucători din întreaga lume.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button size="lg"  href="/play" className="w-full sm:w-auto min-w-[160px]">
              <Swords size={20} />
              Play Chess
            </Button>
            <Button size="lg" variant="outline"  href="/tournaments" className="w-full sm:w-auto min-w-[160px]">
              <Trophy size={20} />
              Join Tournament
            </Button>
            <Button size="lg" variant="secondary"  href="/lobby" className="w-full sm:w-auto min-w-[160px]">
              <Play size={20} />
              Create Game
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {TIME_CONTROLS.slice(0, 6).map((tc) => (
              <Badge key={tc.label} variant="default" size="md">
                {tc.label}
              </Badge>
            ))}
            <Badge variant="default" size="md">+ more</Badge>
          </div>
        </div>
      </section>

      {/* LIVE GAMES + ONLINE PLAYERS */}
      <section className="px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl w-full pb-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    Live Games
                  </CardTitle>
                  <CardDescription>Watch matches in real-time</CardDescription>
                </div>
                <Button variant="ghost" size="sm"  href="/lobby">
                  View all <ArrowRight size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {LIVE_GAMES_FALLBACK.map((g, i) => (
                  <Link
                    key={i}
                    href="/lobby"
                    className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Avatar size="sm" alt={g.white} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {g.white}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {g.ratingW} ELO
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center px-2 sm:px-4">
                      <Badge variant="primary" size="sm">
                        {g.tc}
                      </Badge>
                      <div className="mt-1.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        {g.time}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Move {g.moves}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center gap-2 sm:gap-3 justify-end">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {g.black}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {g.ratingB} ELO
                          </div>
                        </div>
                        <Avatar size="sm" alt={g.black} />
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all flex-shrink-0"
                    />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2.5">
                    <Users size={18} className="text-brand-500" />
                    Online Players
                  </CardTitle>
                  <CardDescription>Find your next opponent</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {TOP_PLAYERS_FALLBACK.slice(0, 6).map((p, i) => (
                  <div
                    key={p.username}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <Avatar
                      src={p.avatar}
                      alt={p.username}
                      size="md"
                      status={p.isOnline ? 'online' : 'offline'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                        {p.username}
                        {i < 3 && (
                          <Badge
                            variant={
                              i === 0
                                ? 'gold'
                                : i === 1
                                  ? 'silver'
                                  : 'bronze'
                            }
                            size="sm"
                          >
                            #{i + 1}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {p.gamesPlayed} games
                      </div>
                    </div>
                    <Badge variant="primary" size="sm">
                      {p.rating}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm"  href="/lobby" className="w-full mt-4">
                See all players <ArrowRight size={16} />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ACTIVE TOURNAMENTS */}
      <section className="px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl w-full pb-16 lg:pb-24">
        <div className="flex items-end justify-between mb-8">
          <div>
            <Badge variant="purple" size="lg" className="mb-3">
              <Trophy size={12} />
              Featured
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Active Tournaments
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Compete for prestige and prizes
            </p>
          </div>
          <Button variant="ghost" size="sm"  href="/tournaments" className="hidden sm:inline-flex">
            Browse all <ArrowRight size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ACTIVE_TOURNAMENTS_FALLBACK.map((t, i) => (
            <Card key={i} hover>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <Badge
                    variant={
                      t.status === 'live'
                        ? 'danger'
                        : t.status === 'registration'
                          ? 'success'
                          : 'default'
                    }
                    size="sm"
                    dot
                  >
                    {t.status === 'live' ? 'LIVE' : 'Registration'}
                  </Badge>
                  <Badge variant="warning" size="sm">
                    {t.type.replace('_', ' ')}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {t.name}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Time</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{t.tc}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Players</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {t.players}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Prize Pool</div>
                    <div className="font-bold text-brand-600 dark:text-brand-400">{t.prize}</div>
                  </div>
                </div>
                <Button variant={t.status === 'live' ? 'primary' : 'secondary'} size="sm"  href="/tournaments" className="w-full">
                  {t.status === 'live' ? 'Watch' : 'Register'}
                  <ArrowRight size={16} />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* LEADERBOARD */}
      <section className="px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl w-full pb-16 lg:pb-24">
        <div className="flex items-end justify-between mb-8">
          <div>
            <Badge variant="gold" size="lg" className="mb-3">
              <Crown size={12} />
              Elite
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Leaderboard
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Top rated players this month
            </p>
          </div>
          <Button variant="ghost" size="sm"  href="/leaderboard" className="hidden sm:inline-flex">
            Full ranking <ArrowRight size={16} />
          </Button>
        </div>

        <Card>
          <CardContent className="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700/60">
                    <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Rank
                    </th>
                    <th className="text-left py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Player
                    </th>
                    <th className="text-right py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                      Games
                    </th>
                    <th className="text-right py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p, i) => (
                    <tr
                      key={p.username + i}
                      className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center">
                          {i === 0 ? (
                            <Badge variant="gold" size="sm">🥇 #1</Badge>
                          ) : i === 1 ? (
                            <Badge variant="silver" size="sm">🥈 #2</Badge>
                          ) : i === 2 ? (
                            <Badge variant="bronze" size="sm">🥉 #3</Badge>
                          ) : (
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 w-10">
                              #{i + 1}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={p.avatar}
                            alt={p.username}
                            size="sm"
                            status={p.isOnline ? 'online' : 'offline'}
                          />
                          <div>
                            <Link
                              href="/profile"
                              className="font-bold text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                            >
                              {p.username}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right text-sm font-medium text-slate-600 dark:text-slate-300 hidden sm:table-cell">
                        {p.gamesPlayed || 0}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="font-bold text-lg text-slate-900 dark:text-slate-100">
                          {p.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FEATURES */}
      <section className="px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl w-full pb-20 lg:pb-28">
        <div className="text-center mb-14">
          <Badge variant="primary" size="lg" className="mb-4">
            Why Chess Arena
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-3xl mx-auto">
            Built for champions,{' '}
            <span className="gradient-text">designed for everyone</span>
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Everything you need for the ultimate chess experience — performance,
            fairness, and community.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {FEATURES.map((f) => (
            <Card key={f.title} hover>
              <CardContent className="space-y-4">
                <div className="h-12 w-12 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-brand-500/25">
                  <f.icon size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl w-full pb-20 lg:pb-28">
        <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12 lg:p-16 text-center gradient-bg shadow-2xl shadow-brand-500/25">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-black/20 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto">
              Ready to play your best game?
            </h2>
            <p className="mt-4 text-white/85 max-w-xl mx-auto text-base sm:text-lg">
              Join thousands of players today. Your first match is one click away.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                size="lg"
                variant="secondary"
                
                href="/register"
                className="bg-white text-brand-700 hover:bg-slate-100 w-full sm:w-auto min-w-[180px]"
              >
                Create Free Account
              </Button>
              <Button
                size="lg"
                variant="ghost"
                
                href="/lobby"
                className="text-white hover:bg-white/15 w-full sm:w-auto min-w-[180px]"
              >
                Quick Play <ArrowRight size={20} />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
