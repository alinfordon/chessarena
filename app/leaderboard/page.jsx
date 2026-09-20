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
import Button from '@/components/ui/Button';

const PLAYERS_FALLBACK = [
  { username: 'GrandMaster99', rating: 2450, blitzRating: 2520, rapidRating: 2430, classicalRating: 2400, gamesPlayed: 1250, gamesWon: 890, gamesDraw: 180, gamesLost: 180, isOnline: true },
  { username: 'ChessKing', rating: 2380, blitzRating: 2410, rapidRating: 2390, classicalRating: 2340, gamesPlayed: 980, gamesWon: 640, gamesDraw: 190, gamesLost: 150, isOnline: true },
  { username: 'TacticalMind', rating: 2315, blitzRating: 2350, rapidRating: 2320, classicalRating: 2280, gamesPlayed: 1540, gamesWon: 1010, gamesDraw: 250, gamesLost: 280, isOnline: false },
  { username: 'EndgameMaster', rating: 2290, blitzRating: 2210, rapidRating: 2290, classicalRating: 2360, gamesPlayed: 870, gamesWon: 570, gamesDraw: 160, gamesLost: 140, isOnline: true },
  { username: 'KnightRider', rating: 2245, blitzRating: 2310, rapidRating: 2250, classicalRating: 2180, gamesPlayed: 1120, gamesWon: 730, gamesDraw: 200, gamesLost: 190, isOnline: true },
  { username: 'QueenGambit', rating: 2210, blitzRating: 2180, rapidRating: 2220, classicalRating: 2225, gamesPlayed: 760, gamesWon: 480, gamesDraw: 160, gamesLost: 120, isOnline: false },
  { username: 'BlitzStorm', rating: 2180, blitzRating: 2310, rapidRating: 2150, classicalRating: 2080, gamesPlayed: 2100, gamesWon: 1350, gamesDraw: 340, gamesLost: 410, isOnline: true },
  { username: 'PawnStorm', rating: 2150, blitzRating: 2180, rapidRating: 2160, classicalRating: 2110, gamesPlayed: 1340, gamesWon: 820, gamesDraw: 250, gamesLost: 270, isOnline: true },
  { username: 'Maria_T', rating: 1610, blitzRating: 1590, rapidRating: 1615, classicalRating: 1620, gamesPlayed: 320, gamesWon: 180, gamesDraw: 70, gamesLost: 70, isOnline: true },
  { username: 'MihaiV', rating: 1520, blitzRating: 1550, rapidRating: 1510, classicalRating: 1500, gamesPlayed: 210, gamesWon: 100, gamesDraw: 45, gamesLost: 65, isOnline: true },
];

async function getPlayers(sortBy = 'rating') {
  try {
    await dbConnect();
    const sort = {};
    sort[sortBy] = -1;
    const players = await User.find({})
      .sort(sort)
      .limit(20)
      .select('username avatar rating blitzRating rapidRating classicalRating gamesPlayed gamesWon gamesDraw gamesLost isOnline')
      .lean();
    if (players && players.length >= 5) return players;
  } catch (e) {
    console.warn('[Leaderboard] Using fallback:', e.message);
  }
  return PLAYERS_FALLBACK;
}

function Table({ players, ratingKey, label }) {
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

      {/* Podium */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-4xl mx-auto">
        {[
          { p: top3[1], place: 2, color: 'from-slate-300 to-slate-400', h: 'h-40', badge: 'silver', icon: '🥈' },
          { p: top3[0], place: 1, color: 'from-amber-300 to-yellow-500', h: 'h-56 -mt-8', badge: 'gold', icon: '🥇' },
          { p: top3[2], place: 3, color: 'from-amber-600 to-amber-700', h: 'h-32', badge: 'bronze', icon: '🥉' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center text-center">
            <div className="mb-3">
              <Avatar
                src={item.p?.avatar}
                alt={item.p?.username}
                size="xl"
                ring={item.place === 1}
                status={item.p?.isOnline ? 'online' : 'offline'}
              />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{item.p?.username}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {item.p?.rating} ELO · {item.p?.gamesPlayed} games
            </p>
            <div className={`w-full rounded-t-2xl bg-gradient-to-b ${item.color} ${item.h} flex flex-col justify-end items-center p-4 shadow-xl`}>
              <div className="text-5xl mb-2">{item.icon}</div>
              <div className="font-black text-white text-2xl">#{item.place}</div>
            </div>
          </div>
        ))}
      </div>

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

      <div className="mt-10 flex justify-center">
        <Button variant="secondary">
          Load more players
        </Button>
      </div>
    </div>
  );
}
