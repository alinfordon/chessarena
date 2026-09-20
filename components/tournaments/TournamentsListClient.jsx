'use client';

import { createContext, useContext, useState } from 'react';
import { Plus, Clock, Trophy, Target, Shuffle, Users, Binary, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

const TournamentsListCtx = createContext(null);

const TC_PRESETS = [
  { label: '3+0 Blitz', initialTime: 180, increment: 0 },
  { label: '5+3 Blitz', initialTime: 300, increment: 3 },
  { label: '10+5 Rapid', initialTime: 600, increment: 5 },
  { label: '15+10 Rapid', initialTime: 900, increment: 10 },
  { label: '30+0 Classical', initialTime: 1800, increment: 0 },
];

const TYPE_OPTIONS = [
  { id: 'arena', name: 'Arena', icon: Shuffle, desc: 'Jocuri continue. Timp total. Scor 2/1/0.' },
  { id: 'swiss', name: 'Swiss', icon: Target, desc: 'Runde cu împerechere pe scor.' },
  { id: 'round_robin', name: 'Round Robin', icon: Users, desc: 'Toți cu toții (max 16 jucători).' },
  { id: 'single_elimination', name: 'KO', icon: Binary, desc: 'Knockout. O înfrângere = eliminat.' },
];

function CreateButton() {
  const ctx = useContext(TournamentsListCtx);
  if (!ctx) return null;
  return (
    <Button size="md" onClick={ctx.open}>
      <Plus size={16} /> Creează Turneu
    </Button>
  );
}

function CreateModal() {
  const router = useRouter();
  const ctx = useContext(TournamentsListCtx);
  if (!ctx) return null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('arena');
  const [tcIdx, setTcIdx] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [minRating, setMinRating] = useState(0);
  const [maxRating, setMaxRating] = useState(3000);
  const [prizePool, setPrizePool] = useState('');
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [durationH, setDurationH] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = name.trim().length >= 3 && tcIdx >= 0 && maxPlayers >= 2;

  const submit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const tc = TC_PRESETS[tcIdx] || TC_PRESETS[0];
      const payload = {
        name: name.trim(),
        description: description.trim(),
        type,
        timeControl: { initialTime: tc.initialTime, increment: tc.increment, label: tc.label.split(' ')[0] },
        maxPlayers: Math.max(2, Math.min(512, parseInt(maxPlayers, 10) || 16)),
        minRating: Math.max(0, parseInt(minRating, 10) || 0),
        maxRating: Math.max(0, parseInt(maxRating, 10) || 3000),
        prizePool: prizePool.trim(),
        startAt: new Date(startAt).toISOString(),
        durationMs: Math.max(1800_000, (parseInt(durationH, 10) || 2) * 3_600_000),
      };
      const r = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) throw new Error(data.error || 'Eroare la crearea turneului');
      ctx.close();
      router.refresh();
      if (data.tournament?._id) {
        router.push(`/tournaments/${data.tournament._id}`);
      }
    } catch (e) {
      setError(e?.message || 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={ctx.isOpen}
      onClose={ctx.close}
      size="lg"
      title="Creează un turneu nou"
      description="Configurează formatul, controlul de timp și detalile turneului."
      footer={
        <>
          <Button variant="ghost" onClick={ctx.close} disabled={loading}>
            Anulează
          </Button>
          <Button onClick={submit} disabled={loading || !canSubmit} loading={loading}>
            <Trophy size={16} /> Creează Turneu
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Nume turneu <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="ex. Weekly Blitz Arena #1"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Descriere
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Scurtă descriere..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Format turneu
          </label>
          <Tabs defaultValue={type} onValueChange={setType} className="w-full">
            <TabsList className="grid grid-cols-4 mb-3 w-full">
              {TYPE_OPTIONS.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>
                  <t.icon size={14} /> <span className="ml-1 hidden sm:inline">{t.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {TYPE_OPTIONS.map((t) => (
              <TabsContent key={t.id} value={t.id}>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <t.icon size={18} className="text-brand-500" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">{t.name}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{t.desc}</p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Control de timp
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TC_PRESETS.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setTcIdx(i)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  tcIdx === i
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-2 ring-brand-500/30'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Clock size={12} /> {t.label.split(' ')[1]}
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{t.label.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Începe (data & ora)
            </label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Durată (ore)
            </label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={durationH}
              onChange={(e) => setDurationH(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Max. jucători
            </label>
            <input
              type="number"
              min={2}
              max={512}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Min. Rating
            </label>
            <input
              type="number"
              min={0}
              max={3000}
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Max. Rating
            </label>
            <input
              type="number"
              min={0}
              max={3000}
              value={maxRating}
              onChange={(e) => setMaxRating(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Premii (opțional)
          </label>
          <input
            type="text"
            value={prizePool}
            onChange={(e) => setPrizePool(e.target.value)}
            maxLength={100}
            placeholder="ex. 5000 points + Badge Campion"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>
      </div>
    </Modal>
  );
}

export default function TournamentsListClient({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <TournamentsListCtx.Provider value={{ isOpen, open, close }}>
      {children}
      <CreateModal />
    </TournamentsListCtx.Provider>
  );
}

TournamentsListClient.CreateButton = CreateButton;
