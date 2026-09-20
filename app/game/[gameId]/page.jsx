import GameClient from './GameClient';

export const metadata = {
  title: 'Partidă Live | Chess Arena',
  description: 'Urmărește sau joacă o partidă de șah live pe Chess Arena.',
  robots: { index: false, follow: false },
};

export default async function GamePage({ params }) {
  const { gameId } = await params;
  return (
    <div className="flex-1">
      <GameClient gameId={gameId} />
    </div>
  );
}
