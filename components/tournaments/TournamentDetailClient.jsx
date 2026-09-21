'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  LogOut,
  UserPlus,
  Wifi,
  WifiOff,
  AlertCircle,
  Users,
  Clock,
  Calendar,
  Crown,
  Target,
  Users2,
  AlignLeft,
  Share2,
  Check,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useSocket } from '@/hooks/useSocket';

const TDCCtx = createContext(null);

const TYPE_META = {
  arena: { label: 'Arena' },
  swiss: { label: 'Swiss' },
  round_robin: { label: 'Round Robin' },
  single_elimination: { label: 'Single Elim.' },
};

export function useTDC() {
  const ctx = useContext(TDCCtx);
  if (!ctx) throw new Error('useTDC must be used within TournamentDetailClient');
  return ctx;
}

function tcLabel(tc) {
  if (!tc) return '—';
  const it = Math.floor(tc.initialTime || 0);
  const inc = tc.increment || 0;
  const mm = Math.floor(it / 60);
  const ss = it % 60;
  const base = ss > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : `${mm}`;
  return inc ? `${base}+${inc}` : base;
}

function prizeLabel(t) {
  const a = Number(t?.prizes?.first) || 0;
  const b = Number(t?.prizes?.second) || 0;
  const c = Number(t?.prizes?.third) || 0;
  if (a || b || c) return `${a} / ${b} / ${c} pts`;
  return t?.prizePool || '—';
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  } catch {
    return '—';
  }
}

function statusMeta(t) {
  if (!t) return { text: '—', variant: 'default', dot: false };
  if (t.status === 'live') return { text: 'LIVE', variant: 'danger', dot: true };
  if (t.status === 'registration') return { text: 'Registration Open', variant: 'success', dot: true };
  if (t.status === 'finished') return { text: 'Finished', variant: 'default', dot: false };
  if (t.status === 'cancelled') return { text: 'Cancelled', variant: 'danger', dot: false };
  return { text: t.status, variant: 'default', dot: false };
}

function arrangeDescription(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return { paragraphs: [], facts: [] };

  const factRe =
    /([\p{Extended_Pictographic}\uFE0F\u200D]*)\s*([\p{L}][\p{L}.]{1,24}):\s*([\p{L}\p{N}#][\p{L}\p{N}#+\-/.]*(?:\s+[\p{Ll}][\p{L}\p{N}#+\-/.]*){0,6})/gu;
  const matches = [...text.matchAll(factRe)];
  let facts = [];
  let body = text;

  if (matches.length >= 2) {
    facts = matches.map((m) => ({
      emoji: (m[1] || '').replace(/\uFE0F/g, '').trim(),
      label: m[2].trim(),
      value: m[3].trim(),
    }));
    const start = matches[0].index;
    const last = matches[matches.length - 1];
    const end = last.index + last[0].length;
    body = `${text.slice(0, start)} ${text.slice(end)}`.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  let paragraphs;
  if (body.includes('\n')) {
    paragraphs = body.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  } else {
    const sentences = body.split(/(?<=[.!?])\s+(?=\S)/u).map((s) => s.trim()).filter(Boolean);
    if (sentences.length <= 2) {
      paragraphs = body ? [body] : [];
    } else {
      paragraphs = [];
      for (let i = 0; i < sentences.length; i += 2) {
        paragraphs.push(sentences.slice(i, i + 2).join(' '));
      }
    }
  }

  return { paragraphs, facts };
}

export default function TournamentDetailClient({ initialDataStr }) {
  const router = useRouter();
  const { toast } = useToast();
  const { connect, connected: globalConnected, on, emit } = useSocket();

  const initial = useMemo(() => {
    try {
      return JSON.parse(initialDataStr || '{}');
    } catch (e) {
      console.error('[TDC] Parse initial data error:', e);
      return {};
    }
  }, [initialDataStr]);

  const [tournament, setTournament] = useState(initial.tournament || null);
  const [players, setPlayers] = useState(initial.players || []);
  const [pairings, setPairings] = useState(initial.pairings || []);
  const [winners, setWinners] = useState(initial.winners || []);
  const [userRegistered, setUserRegistered] = useState(!!initial.userRegistered);
  const [canRegister, setCanRegister] = useState(!!initial.canRegister);
  const [roomConnected, setRoomConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  const tid = tournament?._id;
  const status = tournament?.status || 'registration';
  const userId = initial.userId;
  const typeMeta = TYPE_META[tournament?.type] || TYPE_META.arena;
  const st = statusMeta(tournament);

  useEffect(() => {
    if (!tid || !userId) return;
    const s = connect();
    if (!s) return;
    emit('tournament:join', { tournamentId: tid });
    setRoomConnected(true);

    const h1 = (d) => {
      if (d?.tournamentId && String(d.tournamentId) === String(tid) && Array.isArray(d.players)) {
        setPlayers(d.players.map((p, i) => ({ ...p, rank: i + 1 })));
        if (userId) {
          setUserRegistered(d.players.some((p) => String(p.userId) === String(userId)));
        }
      }
    };
    const h2 = (d) => {
      if (d?.tournamentId && String(d.tournamentId) === String(tid) && d.pairing) {
        setPairings((prev) => {
          const gp = d.pairing;
          const idx = prev.findIndex((g) => g.gameId === gp.gameId);
          const entry = {
            gameId: gp.gameId,
            whitePlayer: gp.white?.id || null,
            blackPlayer: gp.black?.id || null,
            whiteUsername: gp.white?.username,
            blackUsername: gp.black?.username,
            status: gp.status || 'playing',
            movesCount: 0,
            result: null,
            createdAt: new Date().toISOString(),
          };
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...entry };
            return copy;
          }
          return [entry, ...prev];
        });
      }
    };
    const h3 = (d) => {
      if (d?.tournamentId && String(d.tournamentId) === String(tid)) {
        setTournament((prev) => (prev ? { ...prev, status: 'live' } : prev));
      }
    };
    const h4 = (d) => {
      if (d?.tournamentId && String(d.tournamentId) === String(tid)) {
        setTournament((prev) => (prev ? { ...prev, status: 'finished' } : prev));
        if (Array.isArray(d.winners)) setWinners(d.winners.map((id) => ({ _id: id })));
      }
    };
    const h5 = (d) => {
      if (d?.gameId) {
        router.push(`/game/${d.gameId}`);
      }
    };

    const u1 = on('tournament:update', h1);
    const u2 = on('tournament:pairings', h2);
    const u3 = on('tournament:started', h3);
    const u4 = on('tournament:finished', h4);
    const u5 = on('game:matched', h5);

    return () => {
      emit('tournament:leave', { tournamentId: tid });
      try { u1 && u1(); } catch {}
      try { u2 && u2(); } catch {}
      try { u3 && u3(); } catch {}
      try { u4 && u4(); } catch {}
      try { u5 && u5(); } catch {}
    };
  }, [tid, userId, connect, emit, on, router]);

  const doRegister = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/tournaments/${tid}/register`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Registration failed');
      setUserRegistered(true);
      setCanRegister(false);
      router.refresh();
    } catch (e) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [tid, router]);

  const doUnregister = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/tournaments/${tid}/unregister`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not unregister');
      setUserRegistered(false);
      setCanRegister(true);
      router.refresh();
    } catch (e) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [tid, router]);

  const doShare = useCallback(async () => {
    const url = window.location.href.split('#')[0];
    const title = tournament?.name || 'Chess Arena tournament';
    const text = `Join ${title} on Chess Arena`;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    if (mobile && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }

    let copied = false;
    const el = document.createElement('textarea');
    el.value = url;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, url.length);
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    document.body.removeChild(el);

    if (!copied && navigator.clipboard?.writeText) {
      try {
        await Promise.race([
          navigator.clipboard.writeText(url),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
        ]);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setShareCopied(true);
      toast({ title: 'Link copied', variant: 'success' });
      setTimeout(() => setShareCopied(false), 2000);
    } else {
      toast({ title: 'Copy this link', description: url, variant: 'info', duration: 8000 });
    }
  }, [tournament?.name, toast]);

  const ctx = {
    tournament,
    players,
    pairings,
    winners,
    userRegistered,
    canRegister,
    roomConnected,
  };

  const desc = useMemo(
    () => arrangeDescription(tournament?.description),
    [tournament?.description]
  );

  if (!tournament) return null;

  return (
    <TDCCtx.Provider value={ctx}>
      <Card className="mb-8 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 gradient-bg" />
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge variant={st.variant} size="md" dot={st.dot}>{st.text}</Badge>
                <Badge variant="primary" size="md">{typeMeta.label}</Badge>
                <Badge variant="warning" size="md">{tcLabel(tournament.timeControl)}</Badge>
                {tournament.official && <Badge variant="gold" size="md">Official</Badge>}
                <Badge
                  size="sm"
                  variant={globalConnected ? (roomConnected ? 'success' : 'warning') : 'danger'}
                  dot
                  className="gap-1"
                  suppressHydrationWarning
                >
                  {globalConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                  <span className="hidden sm:inline">
                    {globalConnected ? (roomConnected ? 'Live' : 'Connecting...') : 'Offline'}
                  </span>
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                {tournament.name}
              </h1>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
              {error && (
                <div className="p-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 flex items-start gap-2">
                  <AlertCircle size={14} className="text-red-500 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
              {status === 'registration' ? (
                userRegistered ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full md:min-w-[200px]"
                    onClick={doUnregister}
                    disabled={loading}
                    loading={loading}
                  >
                    {!loading && <LogOut size={18} />}
                    Withdraw registration
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full md:min-w-[200px]"
                    onClick={doRegister}
                    disabled={!canRegister || loading}
                    loading={loading}
                  >
                    {!loading && <UserPlus size={18} />}
                    {canRegister ? 'Register now' : 'Closed'}
                  </Button>
                )
              ) : status === 'live' ? (
                <Button size="lg" className="w-full md:min-w-[200px]" variant="primary" disabled>
                  <Trophy size={18} /> In progress
                </Button>
              ) : (
                <Button size="lg" className="w-full md:min-w-[200px]" variant="secondary" disabled>
                  <Crown size={18} /> Tournament closed
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                className="w-full md:min-w-[200px]"
                onClick={doShare}
              >
                {shareCopied ? <Check size={16} /> : <Share2 size={16} />}
                {shareCopied ? 'Link copied' : 'Share Tournament'}
              </Button>
            </div>
          </div>

          {(desc.paragraphs.length > 0 || desc.facts.length > 0) && (
            <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/50">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                <AlignLeft size={13} />
                About
              </div>
              {desc.facts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {desc.facts.map((f) => (
                    <span
                      key={`${f.label}-${f.value}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      {f.emoji ? <span>{f.emoji}</span> : null}
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{f.label}</span>
                      <span>{f.value}</span>
                    </span>
                  ))}
                </div>
              )}
              {desc.paragraphs.length > 0 && (
                <div className="space-y-3">
                  {desc.paragraphs.map((p, i) => (
                    <p
                      key={i}
                      className="text-sm sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700/60">
            {[
              { icon: Users, label: 'Players', value: `${players.length} / ${tournament.maxPlayers || 16}` },
              { icon: Clock, label: 'Time Control', value: tcLabel(tournament.timeControl) },
              { icon: Calendar, label: 'Starts', value: formatDate(tournament.startAt) },
              { icon: Crown, label: 'Prizes', value: prizeLabel(tournament) },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
                <s.icon size={18} className="text-brand-500 mb-2" />
                <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                <div className="font-bold text-lg text-slate-900 dark:text-slate-100" suppressHydrationWarning>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {status === 'finished' && winners.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <Crown size={18} className="text-amber-500" />
              Winners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {winners.map((w, i) => (
                <div
                  key={w._id || i}
                  className={`p-5 rounded-2xl border text-center ${
                    i === 0
                      ? 'bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 border-amber-200 dark:border-amber-900/60'
                      : i === 1
                        ? 'bg-gradient-to-b from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700'
                        : 'bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/20 dark:to-slate-900 border-orange-200 dark:border-orange-900/50'
                  }`}
                >
                  <div className="text-3xl mb-2">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </div>
                  <Avatar src={w.avatar} alt={w.username} size="lg" className="mx-auto mb-2 ring-4 ring-white dark:ring-slate-900" />
                  <div className="font-bold text-slate-900 dark:text-slate-100">{w.username || 'Winner'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Rating: {w.rating || 1200}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StandingsCard />
        <div className="space-y-6">
          <PairingsCard />
          <FormatCard t={tournament} />
          <PrizesCard t={tournament} />
        </div>
      </div>
    </TDCCtx.Provider>
  );
}

function StandingsCard() {
  const { players } = useTDC();
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Users2 size={18} className="text-brand-500" />
          Live Standings
        </CardTitle>
        <CardDescription>{players.length} registered players — updated in real time</CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        {players.length === 0 ? (
          <div className="p-8 text-center">
            <Users size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No players registered yet. Be the first!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-right px-4 py-3">Rating</th>
                  <th className="text-right px-4 py-3">Scor</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">V/D/E</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Buch.</th>
                  <th className="text-right px-4 py-3">Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {players.map((p) => (
                  <tr key={p.userId || p._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : 'default'
                        }
                        size="sm"
                      >
                        #{p.rank}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={p.avatar} alt={p.username} size="sm" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {p.username || 'Unknown'}
                          </div>
                          {p.status === 'eliminated' && (
                            <Badge variant="danger" size="sm">Eliminated</Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{p.rating}</td>
                    <td className="text-right px-4 py-3">
                      <span className="font-bold text-brand-600 dark:text-brand-400">{p.score}</span>
                    </td>
                    <td className="text-right px-4 py-3 text-xs text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                      {p.wins}/{p.draws || 0}/{p.losses || 0}
                    </td>
                    <td className="text-right px-4 py-3 text-xs text-slate-600 dark:text-slate-400 hidden md:table-cell">
                      {p.buchholz || 0}
                    </td>
                    <td className="text-right px-4 py-3 text-slate-600 dark:text-slate-400">{p.gamesPlayed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PairingsCard() {
  const { pairings } = useTDC();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Target size={18} className="text-amber-500" />
          Matches
        </CardTitle>
        <CardDescription>{pairings.length} recorded matches</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {pairings.length === 0 ? (
          <div className="p-4 text-center">
            <Target size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No matches yet. Start the tournament to see pairings.
            </p>
          </div>
        ) : (
          pairings.map((g) => (
            <Link
              key={g.gameId}
              href={`/game/${g.gameId}`}
              className="block p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <Badge
                  size="sm"
                  variant={
                    g.status === 'playing' ? 'success' : g.status === 'finished' ? 'default' : 'warning'
                  }
                >
                  {g.status === 'playing' ? 'LIVE' : g.status === 'finished' ? 'Finished' : 'Waiting'}
                </Badge>
                {g.result && (
                  <Badge
                    size="sm"
                    variant={
                      g.result === 'white' ? 'success' : g.result === 'black' ? 'success' : 'warning'
                    }
                  >
                    {g.result === 'white' ? '1-0 White' : g.result === 'black' ? '0-1 Black' : '½-½'}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs sm:text-sm">
                <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                  {g.whiteUsername || 'White'} <span className="text-slate-400">({g.whiteRating || 1200})</span>
                </div>
                <span className="text-slate-400 text-[10px]">vs</span>
                <div className="truncate font-semibold text-slate-900 dark:text-slate-100 text-right">
                  <span className="text-slate-400">({g.blackRating || 1200})</span> {g.blackUsername || 'Black'}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{g.movesCount || 0} moves</span>
                <span className="group-hover:text-brand-600 dark:group-hover:text-brand-400 font-semibold">
                  View game →
                </span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function FormatCard({ t }) {
  const rounds = t.rounds || 0;
  const hours = t.durationMs ? Math.round(t.durationMs / 3_600_000) : '—';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Target size={18} className="text-amber-500" />
          Format
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {[
          { label: 'Type', value: (TYPE_META[t.type] || TYPE_META.arena).label },
          { label: 'Rounds', value: rounds || '—' },
          { label: 'Duration', value: typeof hours === 'number' ? `${hours}h` : hours },
          { label: 'Min. Rating', value: t.minRating ?? 0 },
          { label: 'Max. Rating', value: t.maxRating ?? 3000 },
          { label: 'Scoring', value: `${t.scoring?.win ?? 2} / ${t.scoring?.draw ?? 1} / ${t.scoring?.loss ?? 0}` },
        ].map((r, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{r.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PrizesCard({ t }) {
  const rows = [
    { rank: 1, pts: Number(t.prizes?.first) || 0, fallback: 'Glory + Trophy Badge', color: 'gold' },
    { rank: 2, pts: Number(t.prizes?.second) || 0, fallback: 'Silver Badge', color: 'silver' },
    { rank: 3, pts: Number(t.prizes?.third) || 0, fallback: 'Bronze Badge', color: 'bronze' },
  ];
  const hasPts = rows.some((p) => p.pts > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Crown size={18} className="text-amber-500" />
          Prizes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {t.prizePool ? (
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
            <div className="text-xs text-amber-600 dark:text-amber-400">Prize note</div>
            <div className="font-bold text-amber-800 dark:text-amber-200 text-lg">{t.prizePool}</div>
          </div>
        ) : null}
        {rows.map((p) => (
          <div key={p.rank} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
            <Badge variant={p.color} size="lg">#{p.rank}</Badge>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {hasPts ? `${p.pts} points` : p.fallback}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
