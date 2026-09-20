'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, LogOut, UserPlus, Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useSocket } from '@/hooks/useSocket';

const TDCCtx = createContext(null);

export function useTDC() {
  const ctx = useContext(TDCCtx);
  if (!ctx) throw new Error('useTDC must be used within TournamentDetailClient');
  return ctx;
}

export default function TournamentDetailClient({ initialDataStr, children }) {
  const router = useRouter();
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

  const tid = tournament?._id;
  const status = tournament?.status || 'registration';
  const userId = initial.userId;

  useEffect(() => {
    if (!tid || !userId) return;
    const s = connect(userId);
    if (!s) return;
    emit('tournament:join', { tournamentId: tid });
    setRoomConnected(true);

    const h1 = (d) => {
      if (d?.tournamentId && String(d.tournamentId) === String(tid) && Array.isArray(d.players)) {
        setPlayers(d.players.map((p, i) => ({ ...p, rank: i + 1 })));
        if (userId) {
          setUserRegistered(d.players.some(p => String(p.userId) === String(userId)));
        }
      }
    };
    const h2 = (d) => {
      if (d?.tournamentId && String(d.tournamentId) === String(tid) && d.pairing) {
        setPairings((prev) => {
          const gp = d.pairing;
          const idx = prev.findIndex(g => g.gameId === gp.gameId);
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
        setTournament((prev) => prev ? { ...prev, status: 'live' } : prev);
      }
    };
    const h4 = (d) => {
      if (d?.tournamentId && String(d.tournamentId) === String(tid)) {
        setTournament((prev) => prev ? { ...prev, status: 'finished' } : prev);
        if (Array.isArray(d.winners)) setWinners(d.winners.map(id => ({ _id: id })));
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

  const socketBadge = (
    <Badge
      size="sm"
      variant={globalConnected ? (roomConnected ? 'success' : 'warning') : 'danger'}
      dot
      className="gap-1"
    >
      {globalConnected ? (roomConnected ? <Wifi size={10} /> : <Wifi size={10} />) : <WifiOff size={10} />}
      <span className="hidden sm:inline">
        {globalConnected ? (roomConnected ? 'Live' : 'Connecting...') : 'Offline'}
      </span>
    </Badge>
  );

  const registerBtn = (
    <>
      {error && (
        <div className="mb-2 p-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      <Button
        size="lg"
        className="w-full md:min-w-[200px]"
        onClick={doRegister}
        disabled={!canRegister || loading}
        loading={loading}
      >
        {!loading && <UserPlus size={18} />}
        {canRegister ? 'Register now' : (userRegistered ? 'Already registered' : 'Closed')}
      </Button>
    </>
  );

  const unregisterBtn = (
    <>
      {error && (
        <div className="mb-2 p-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      <Button
        size="lg"
        variant="outline"
        className="w-full md:min-w-[200px]"
        onClick={doUnregister}
        disabled={status !== 'registration' || loading}
        loading={loading}
      >
        {!loading && <LogOut size={18} />}
        Withdraw registration
      </Button>
    </>
  );

  const ctx = {
    tournament,
    players,
    pairings,
    winners,
    userRegistered,
    canRegister,
    roomConnected,
  };

  if (typeof children === 'function') {
    return (
      <TDCCtx.Provider value={ctx}>
        {children({
          status,
          registerBtn,
          unregisterBtn,
          socketBadge,
          winnersLive: winners,
        })}
      </TDCCtx.Provider>
    );
  }

  return <TDCCtx.Provider value={ctx}>{children}</TDCCtx.Provider>;
}
