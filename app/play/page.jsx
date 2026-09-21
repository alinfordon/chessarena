import PlayClient from './PlayClient';

export const metadata = {
  title: 'Play Chess',
  description:
    'Start a live chess game on Chess Arena: Quick Match, custom time controls, or invite a friend. Built by Sky Game & Robotics Development.',
};

export default function PlayPage() {
  return (
    <div className="flex-1">
      <PlayClient />
    </div>
  );
}
