import LobbyClient from './LobbyClient';
import dbConnect from '@/lib/mongodb';
import Game from '@/models/Game';
import User from '@/models/User';

export const metadata = {
  title: 'Lobby | Chess Arena',
  description: 'Găsește sau creează o partidă de șah.',
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
        .populate('whitePlayerId', 'username rating blitzRating rapidRating classicalRating isOnline avatar')
        .populate('blackPlayerId', 'username rating blitzRating rapidRating classicalRating isOnline avatar')
        .select(
          'gameId status initialTime increment whitePlayerId blackPlayerId whiteUsername blackUsername whiteRating blackRating movesCount isPrivate inviteCode ratingCategory startedAt createdAt'
        )
        .lean(),
      User.find({ isOnline: true })
        .select('username rating blitzRating rapidRating classicalRating isOnline avatar')
        .sort({ rating: -1 })
        .limit(30)
        .lean(),
    ]);
    return {
      games: (games || []).map((g) => ({
        ...g,
        _id: undefined,
        whitePlayerId: undefined,
        blackPlayerId: undefined,
      })),
      online: online || [],
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
