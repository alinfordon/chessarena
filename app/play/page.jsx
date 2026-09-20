import PlayClient from './PlayClient';

export const metadata = {
  title: 'New Game | Chess Arena',
  description: 'Create a chess game: Quick Match, Custom, or invite a friend.',
};

export default function PlayPage() {
  return (
    <div className="flex-1">
      <PlayClient />
    </div>
  );
}
