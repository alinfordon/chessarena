import PlayClient from './PlayClient';

export const metadata = {
  title: 'Joc Nou | Chess Arena',
  description: 'Creează o partidă de șah: Quick Match, Custom sau invită un prieten.',
};

export default function PlayPage() {
  return (
    <div className="flex-1">
      <PlayClient />
    </div>
  );
}
