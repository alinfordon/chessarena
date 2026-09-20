import Link from 'next/link';
import {
  Trophy, Users, Clock, Plus, ArrowRight, Calendar, Crown, Shuffle, Target, Swords, Binary } from 'lucide-react';
import dbConnect from '@/lib/mongodb';
import Tournament from '@/models/Tournament';
import TournamentPlayer from '@/models/TournamentPlayer';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import TournamentsListClient, { CreateButton } from '@/components/tournaments/TournamentsListClient';

const TYPE_META = {
  arena: { icon: Shuffle, label: 'Arena' },
  swiss: { icon: Target, label: 'Swiss' },
  round_robin: { icon: Users, label: 'Round Robin' },
  single_elimination: { icon: Binary, label: 'Single Elim.' },
};

const TYPES = [
  { id: 'arena', name: 'Arena', icon: Shuffle, desc: 'Joacă cât mai multe jocuri posibil într-un timp fix. Mai multe victorii = scor mai mare.' },
  { id: 'swiss', name: 'Swiss', icon: Target, desc: 'Jucătorii cu scoruri similare se întâlnesc. Cel mai bun pentru turnee mari.' },
  { id: 'round_robin', name: 'Round Robin', icon: Users, desc: 'Toți se întâlnesc cu toții. Echitabil dar mai lung. Bun pentru grupuri mici.' },
  { id: 'single_elimination', name: 'Single Elimination', icon: Binary, desc: 'Pierzi o dată și ești afară. Risc ridicat și terminări rapide.' },
];

export const dynamic = 'force-dynamic';

export default async function TournamentsPage() {
  let tournaments = [];
  try {
    await dbConnect();
    const docs = await Tournament.find({})
      .sort({ status: 1, startAt: 1, createdAt: -1 })
      .populate('createdBy', 'username avatar')
      .limit(50)
      .lean();

    tournaments = await Promise.all(
      docs.map(async (t) => {
        const count = await TournamentPlayer.countDocuments({ tournamentId: t._id });
        return { ...t, currentPlayers: count };
      })
    );
  } catch (e) {
    console.error('[Tournaments] DB error:', e?.message || e);
  }

  const statusLabel = (s) => {
    if (s === 'live') return { text: 'LIVE', variant: 'danger' };
    if (s === 'registration') return { text: 'Înscriere', variant: 'success' };
    if (s === 'finished') return { text: 'Finalizat', variant: 'default' };
    return { text: s, variant: 'default' };
  };

  const tcLabel = (tc) => {
    if (!tc) return '—';
    const it = Math.floor(tc.initialTime || 0);
    const inc = tc.increment || 0;
    const mm = Math.floor(it / 60);
    const ss = it % 60;
    const base = ss > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : `${mm}`;
    return inc ? `${base}+${inc}` : base;
  };

  const startLabel = (t) => {
    if (t.status === 'live') return t.currentRound > 0 ? `Runda ${t.currentRound} / ${t.rounds || '?'}` : 'În desfășurare';
    if (t.status === 'finished') return 'Finalizat';
    const ts = t.startAt ? new Date(t.startAt).getTime() : 0;
    const now = Date.now();
    const diff = ts - now;
    if (diff <= 0) return 'În curând';
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(h / 24);
    if (d > 0) return `În ${d} zile`;
    if (h > 0) return `În ${h} ore`;
    const m = Math.floor(diff / 60000);
    return `În ${m} minute`;
  };

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl w-full py-8 lg:py-12 animate-fade-in">
      <TournamentsListClient>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-10">
          <div>
            <Badge variant="purple" size="lg" className="mb-3">
            <Trophy size={12} /> Turnee
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Compete pentru Glorie
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
            Alătură-te turnee de toate formatele și câștigă recompense exclusive
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="md">
            <Calendar size={16} /> Program
          </Button>
          <CreateButton />
        </div>
      </div>
      </TournamentsListClient>

      {/* Tournament types */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {TYPES.map((t) => (
          <Card key={t.id} hover>
            <CardContent className="space-y-3">
              <div className="h-11 w-11 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-brand-500/20">
                <t.icon size={22} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.name}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-end justify-between mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Crown size={22} className="text-amber-500" />
          Toate Turneele
        </h2>
      </div>

      {tournaments.length === 0 ? (
        <div className="p-10 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
          <Trophy size={40} className="mx-auto text-slate-400" />
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            Nu există turnee create încă
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Creează primul turneu folosind butonul de mai sus.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tournaments.map((t) => {
          const meta = TYPE_META[t.type] || TYPE_META.arena;
          const TypeIcon = meta.icon;
          const st = statusLabel(t.status);
          const mp = t.maxPlayers || 16;
          const cp = t.currentPlayers || 0;
          const pct = Math.min(100, Math.round((cp / mp) * 100));
          return (
            <Card key={String(t._id)} hover>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={st.variant} size="sm" dot>{st.text}</Badge>
                    <Badge variant="primary" size="sm" className="gap-1">
                      <TypeIcon size={10} /> {meta.label}
                    </Badge>
                  </div>
                  <Badge variant="warning" size="sm">{tcLabel(t.timeControl)}</Badge>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {t.name}
                </h3>
                {t.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    {t.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Jucători</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {cp} / {mp}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1.5 overflow-hidden">
                      <div className="h-full gradient-bg" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Premii</div>
                    <div className="font-bold text-brand-600 dark:text-brand-400">
                      {t.prizePool || '—'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      {startLabel(t)}
                    </div>
                  </div>
                </div>

                <Button
                  variant={t.status === 'live' ? 'primary' : t.status === 'registration' ? 'secondary' : 'ghost'}
                  size="sm"
                  href={`/tournaments/${t._id}`}
                  className="w-full"
                >
                  {t.status === 'live' ? (
                    <>Vezi Acum <Swords size={14} /></>
                  ) : t.status === 'registration' ? (
                    <>Înscrie-te <ArrowRight size={14} /></>
                  ) : (
                    <>Vezi Rezultate <ArrowRight size={14} /></>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}
