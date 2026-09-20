import LobbyClient from './LobbyClient';
import dbConnect from '@/lib/mongodb';
import Game from '@/models/Game';
import User from '@/models/User';

export const metadata = {
  title: 'Lobby | Chess Arena',
  description: 'Find or create a chess game.',
};

const FALLBACK_GAMES = [];
const FALLBACK_ONLINE = [];

async function getInitial() {
  try {
    await dbConnect();
    const [games, online] = await Promise.all([
      Game.find({ status: { $in: ['waiting', 'playing'] } })
        .sort({ createdAt: -1 })
        .limit(40)
        .select(
          'gameId status initialTime increment whitePlayer blackPlayer whiteUsername blackUsername whiteRating blackRating moves isPrivate inviteCode ratingCategory startedAt createdAt'
        )
        .lean(),
      User.find({ isOnline: true })
        .select('username rating blitzRating rapidRating classicalRating isOnline avatar gamesPlayed')
        .sort({ rating: -1 })
        .limit(30)
        .lean(),
    ]);
    return {
      games: (games || []).map((g) => ({
        gameId: g.gameId,
        status: g.status,
        initialTime: g.initialTime,
        increment: g.increment,
        whiteUsername: g.whiteUsername || null,
        blackUsername: g.blackUsername || null,
        whiteRating: g.whiteRating ?? null,
        blackRating: g.blackRating ?? null,
        movesCount: Array.isArray(g.moves) ? g.moves.length : 0,
        isPrivate: !!g.isPrivate,
        inviteCode: g.inviteCode || null,
        ratingCategory: g.ratingCategory || null,
        startedAt: g.startedAt || null,
        createdAt: g.createdAt || null,
      })),
      online: (online || []).map((u) => ({
        _id: u._id?.toString?.() || u._id,
        username: u.username,
        rating: u.rating || 1200,
        blitzRating: u.blitzRating,
        rapidRating: u.rapidRating,
        classicalRating: u.classicalRating,
        isOnline: !!u.isOnline,
        avatar: u.avatar || null,
        gamesPlayed: u.gamesPlayed || 0,
      })),
    };
  } catch (e) {
    console.warn('[Lobby] Using fallback:', e.message);
    return { games: FALLBACK_GAMES, online: FALLBACK_ONLINE };
  }
}

export default async function LobbyPage() {
  const initial = await getInitial();
  return (
    <div className="flex-1">
      <LobbyClient initialGames={initial.games} initialOnline={initial.online} />
    </div>
  );
}
