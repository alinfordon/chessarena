import GameClient from './GameClient';

export const metadata = {
  title: 'Live Game',
  description: 'Watch or play a live chess game on Chess Arena.',
  robots: { index: false, follow: false },
};

export default async function GamePage({ params }) {
  const { gameId } = await params;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <GameClient gameId={gameId} />
    </div>
  );
}
