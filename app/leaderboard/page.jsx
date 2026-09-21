import Link from 'next/link';
import { Crown, Swords, Zap, Award } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Leaderboard',
  description:
    'See the top Chess Arena players by Elo rating across blitz, rapid, and classical time controls.',
};

function serializePlayer(u) {
  return {
    username: u.username,
    avatar: u.avatar || null,
    rating: u.rating ?? 1200,
    blitzRating: u.blitzRating ?? 1200,
    rapidRating: u.rapidRating ?? 1200,
    classicalRating: u.classicalRating ?? 1200,
    gamesPlayed: u.gamesPlayed || 0,
    gamesWon: u.gamesWon || 0,
    gamesDraw: u.gamesDraw || 0,
    gamesLost: u.gamesLost || 0,
    isOnline: Boolean(u.isOnline),
  };
}

async function getPlayers(sortBy = 'rating') {
  try {
    await dbConnect();
    const players = await User.find({})
      .sort({ [sortBy]: -1, gamesPlayed: -1, username: 1 })
      .limit(50)
      .select('username avatar rating blitzRating rapidRating classicalRating gamesPlayed gamesWon gamesDraw gamesLost isOnline')
      .lean();
    return (players || []).map(serializePlayer);
  } catch (e) {
    console.error('[Leaderboard]', e?.message || e);
    return [];
  }
}

function Table({ players, ratingKey, label }) {
  if (!players.length) {
    return (
      <div className="p-10 text-center">
        <Crown size={36} className="mx-auto mb-3 text-slate-400" />
        <p className="font-semibold text-slate-700 dark:text-slate-300">No players yet</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          The ranking fills up as accounts are created.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700/60 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            <th className="text-left py-4 px-5">Rank</th>
            <th className="text-left py-4 px-5">Player</th>
            <th className="text-right py-4 px-5">{label}</th>
            <th className="text-right py-4 px-5 hidden sm:table-cell">Games</th>
            <th className="text-right py-4 px-5 hidden md:table-cell">W</th>
            <th className="text-right py-4 px-5 hidden md:table-cell">D</th>
            <th className="text-right py-4 px-5 hidden md:table-cell">L</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const rating = p[ratingKey] ?? p.rating;
            const winRate = p.gamesPlayed
              ? Math.round(((p.gamesWon + p.gamesDraw * 0.5) / p.gamesPlayed) * 100)
              : 0;
            return (
              <tr
                key={p.username + i}
                className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td className="py-4 px-5">
                  {i === 0 ? (
                    <Badge variant="gold" size="md">🥇 #1</Badge>
                  ) : i === 1 ? (
                    <Badge variant="silver" size="md">🥈 #2</Badge>
                  ) : i === 2 ? (
                    <Badge variant="bronze" size="md">🥉 #3</Badge>
                  ) : (
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400 w-10 inline-block">
                      #{i + 1}
                    </span>
                  )}
                </td>
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={p.avatar}
                      alt={p.username}
                      size="md"
                      status={p.isOnline ? 'online' : 'offline'}
                    />
                    <div>
                      <Link
                        href="/profile"
                        className="font-bold text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                      >
                        {p.username}
                      </Link>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {winRate}% win rate
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-5 text-right">
                  <span className="font-black text-xl text-slate-900 dark:text-slate-100">{rating}</span>
                </td>
                <td className="py-4 px-5 text-right text-sm font-semibold text-slate-700 dark:text-slate-300 hidden sm:table-cell">
                  {p.gamesPlayed || 0}
                </td>
                <td className="py-4 px-5 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400 hidden md:table-cell">
                  {p.gamesWon || 0}
                </td>
                <td className="py-4 px-5 text-right text-sm font-semibold text-amber-600 dark:text-amber-400 hidden md:table-cell">
                  {p.gamesDraw || 0}
                </td>
                <td className="py-4 px-5 text-right text-sm font-semibold text-red-600 dark:text-red-400 hidden md:table-cell">
                  {p.gamesLost || 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function LeaderboardPage() {
  const [byRating, byBlitz, byRapid, byClassical] = await Promise.all([
    getPlayers('rating'),
    getPlayers('blitzRating'),
    getPlayers('rapidRating'),
    getPlayers('classicalRating'),
  ]);

  const top3 = byRating.slice(0, 3);

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl w-full py-8 lg:py-12 animate-fade-in">
      <div className="text-center mb-10">
        <Badge variant="gold" size="lg" className="mb-3">
          <Crown size={12} /> Leaderboard
        </Badge>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
          Top Players
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          The best of the best. Climb the ranks by winning rated matches.
        </p>
      </div>

      {top3.length > 0 && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-4xl mx-auto">
        {[
          { p: top3[1], place: 2, color: 'from-slate-300 to-slate-400', h: 'h-40', badge: 'silver', icon: '🥈' },
          { p: top3[0], place: 1, color: 'from-amber-300 to-yellow-500', h: 'h-56 -mt-8', badge: 'gold', icon: '🥇' },
          { p: top3[2], place: 3, color: 'from-amber-600 to-amber-700', h: 'h-32', badge: 'bronze', icon: '🥉' },
        ].filter((item) => item.p).map((item) => (
          <div key={item.place} className="flex flex-col items-center text-center">
            <div className="mb-3">
              <Avatar
                src={item.p.avatar}
                alt={item.p.username}
                size="xl"
                ring={item.place === 1}
                status={item.p.isOnline ? 'online' : 'offline'}
              />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{item.p.username}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {item.p.rating} ELO · {item.p.gamesPlayed} games
            </p>
            <div className={`w-full rounded-t-2xl bg-gradient-to-b ${item.color} ${item.h} flex flex-col justify-end items-center p-4 shadow-xl`}>
              <div className="text-5xl mb-2">{item.icon}</div>
              <div className="font-black text-white text-2xl">#{item.place}</div>
            </div>
          </div>
        ))}
      </div>
      )}

      <Tabs defaultValue="overall">
        <div className="flex justify-center mb-6">
          <TabsList>
            <TabsTrigger value="overall"><Award size={14} /> Overall</TabsTrigger>
            <TabsTrigger value="blitz"><Zap size={14} /> Blitz</TabsTrigger>
            <TabsTrigger value="rapid"><Swords size={14} /> Rapid</TabsTrigger>
            <TabsTrigger value="classical"><Crown size={14} /> Classical</TabsTrigger>
          </TabsList>
        </div>

        <Card>
          <CardHeader className="sm:hidden">
            <CardTitle>Leaderboard</CardTitle>
            <CardDescription>Ranked by rating</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <TabsContent value="overall"><Table players={byRating} ratingKey="rating" label="Rating" /></TabsContent>
            <TabsContent value="blitz"><Table players={byBlitz} ratingKey="blitzRating" label="Blitz" /></TabsContent>
            <TabsContent value="rapid"><Table players={byRapid} ratingKey="rapidRating" label="Rapid" /></TabsContent>
            <TabsContent value="classical"><Table players={byClassical} ratingKey="classicalRating" label="Classical" /></TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
