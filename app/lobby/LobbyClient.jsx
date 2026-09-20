'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users,
  Swords,
  Clock,
  Play,
  Lock,
  Unlock,
  Plus,
  ArrowRight,
  Eye,
  Wifi,
  WifiOff,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import Button from '@/components/ui/Button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { formatTimeCompact, timeAgo } from '@/utils/time';
import { timeControlToCategory } from '@/utils/chess';

function normalizeLobbyGame(g) {
  if (!g) return null;
  return {
    gameId: g.gameId,
    status: g.status,
    initialTime: g.initialTime,
    increment: g.increment,
    whiteUsername: g.whiteUsername || g.whitePlayer?.username || null,
    blackUsername: g.blackUsername || g.blackPlayer?.username || null,
    whiteRating: g.whiteRating ?? g.whitePlayer?.rating ?? null,
    blackRating: g.blackRating ?? g.blackPlayer?.rating ?? null,
    movesCount: typeof g.movesCount === 'number' ? g.movesCount : (g.moves?.length || 0),
    isPrivate: !!g.isPrivate,
    inviteCode: g.inviteCode || null,
    ratingCategory: g.ratingCategory || null,
    startedAt: g.startedAt || null,
    createdAt: g.createdAt || null,
  };
}

function upsertGame(list, incoming) {
  const game = normalizeLobbyGame(incoming);
  if (!game?.gameId) return list;
  const idx = list.findIndex((g) => g.gameId === game.gameId);
  if (idx === -1) return [game, ...list];
  const next = [...list];
  next[idx] = { ...next[idx], ...game };
  return next;
}

export default function LobbyClient({ initialGames = [], initialOnline = [] }) {
  const router = useRouter();
  const { connected, on, off, emit } = useSocket();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [games, setGames] = useState(initialGames);
  const [online, setOnline] = useState(initialOnline);
  const [joinModal, setJoinModal] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (initialGames?.length) {
      setGames(initialGames.map(normalizeLobbyGame).filter(Boolean));
    }
    if (initialOnline?.length) setOnline(initialOnline);
  }, [initialGames, initialOnline]);

  useEffect(() => {
    let cancelled = false;
    const loadGames = async () => {
      try {
        const res = await fetch('/api/games?status=waiting,playing&limit=50', {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await res.json();
        if (!cancelled && data?.ok && Array.isArray(data.games)) {
          setGames(data.games.map(normalizeLobbyGame).filter(Boolean));
        }
      } catch (e) {
        console.warn('[Lobby] Failed to refresh games:', e?.message || e);
      }
    };
    loadGames();
    const timer = setInterval(loadGames, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connected]);

  useEffect(() => {
    const handlers = [];
    const add = (event, fn) => {
      const unsub = on(event, fn);
      handlers.push(unsub);
    };
    add('lobby:update', (payload) => {
      if (Array.isArray(payload?.games)) {
        setGames(payload.games.map(normalizeLobbyGame).filter(Boolean));
        return;
      }
      if (payload?.game) {
        setGames((prev) => upsertGame(prev, payload.game));
        return;
      }
      if (payload?.gameId) {
        setGames((prev) =>
          prev.map((g) => (g.gameId === payload.gameId ? { ...g, ...payload } : g))
        );
      }
      if (payload?.online) setOnline(payload.online);
    });
    add('lobby:new-game', (payload) => {
      setGames((prev) => upsertGame(prev, payload?.game || payload));
    });
    add('user:presence', (payload) => {
      if (payload?.users) setOnline(payload.users);
    });
    return () => handlers.forEach((u) => u());
  }, [on, off]);

  const waitingRooms = useMemo(
    () =>
      games.filter((g) => {
        if (g.status !== 'waiting') return false;
        if (!g.isPrivate) return true;
        return user && (g.whiteUsername === user.username || g.blackUsername === user.username);
      }),
    [games, user]
  );
  const liveGames = useMemo(
    () => games.filter((g) => g.status === 'playing'),
    [games]
  );

  const handleJoin = useCallback(
    async (game, withCode = null) => {
      if (!isAuthenticated) {
        toast({ title: 'Trebuie să fiți logat', variant: 'warning' });
        router.push('/login');
        return;
      }
      if (game.isPrivate && !withCode) {
        setJoinModal(game);
        setInviteCode('');
        return;
      }
      setJoinLoading(true);
      try {
        const body = {};
        if (game.isPrivate) body.inviteCode = withCode;
        const res = await fetch(`/api/games/${game.gameId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });
        const data = await res.json();
        setJoinLoading(false);
        if (!data.ok) {
          toast({
            title: data.error || 'Nu puteți intra',
            variant: 'warning',
          });
          return;
        }
        toast({
          title: data.spectator ? 'Ați intrat ca spectator' : 'Ați intrat în joc!',
          variant: 'success',
        });
        router.push(`/game/${game.gameId}`);
      } catch (e) {
        setJoinLoading(false);
        toast({ title: 'Eroare rețea', variant: 'warning' });
      }
    },
    [isAuthenticated, router, toast]
  );

  const confirmJoinWithCode = () => {
    if (!joinModal) return;
    handleJoin(joinModal, inviteCode.trim().toUpperCase());
    setJoinModal(null);
  };

  const copyInvite = (game) => {
    const url = `${window.location.origin}/play?invite=${game.inviteCode}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(game.gameId);
      toast({ title: 'Link copiat!', variant: 'success' });
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const GameRow = ({ g, isLive }) => {
    const tc = `${Math.floor(g.initialTime / 60)}+${g.increment}`;
    const cat = timeControlToCategory(g.initialTime).label;
    const movesCount = typeof g.movesCount === 'number' ? g.movesCount : (g.moves?.length || 0);
    const mine =
      user && (g.whiteUsername === user.username || g.blackUsername === user.username);
    const hasWhite = !!g.whiteUsername;
    const hasBlack = !!g.blackUsername;
    const joinable = !isLive && g.status === 'waiting' && (!hasWhite || !hasBlack);

    return (
      <div
        className="group flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/60 last:border-0"
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3">
          <Avatar size="sm" alt={g.whiteUsername || 'Liber'} />
          <div className="min-w-0">
            <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
              {g.whiteUsername || 'Liber'}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
              {g.whiteRating || '—'}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center px-1 sm:px-4 gap-0.5 min-w-[72px] sm:min-w-[90px]">
          <div className="flex items-center gap-1">
            <Badge variant="primary" size="sm">{tc}</Badge>
            {g.isPrivate && (
              <Badge variant="warning" size="sm" title="Privat">
                <Lock size={10} />
              </Badge>
            )}
          </div>
          {isLive ? (
            <>
              <div className="text-[10px] sm:text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">
                {timeAgo(g.startedAt)}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Mv {movesCount}
              </div>
            </>
          ) : (
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
              {cat} · {timeAgo(g.createdAt)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 justify-end">
          <div className="text-right min-w-0">
            <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
              {g.blackUsername || 'Liber'}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
              {g.blackRating || '—'}
            </div>
          </div>
          <Avatar size="sm" alt={g.blackUsername || 'Liber'} status={g.blackUsername ? 'online' : null} />
        </div>

        <div className="ml-2 flex items-center gap-1">
          {isLive ? (
            mine ? (
              <Button size="sm" variant="primary" href={`/game/${g.gameId}`}>
                <Swords size={13} /> Continuă
              </Button>
            ) : (
              <Button size="sm" variant="ghost" href={`/game/${g.gameId}`}>
                <Eye size={13} /> Spectate
              </Button>
            )
          ) : (
            <>
              {g.isPrivate && (
                <Button
                  size="iconSm"
                  variant="ghost"
                  title="Copiază link invitație"
                  onClick={() => copyInvite(g)}
                >
                  {copied === g.gameId ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              )}
              <Button
                size="sm"
                variant={joinable ? 'success' : 'ghost'}
                onClick={() => (joinable ? handleJoin(g) : router.push(`/game/${g.gameId}`))}
              >
                {joinable ? (
                  <>
                    <Swords size={13} /> Join
                  </>
                ) : (
                  <>
                    <Eye size={13} /> Spectate
                  </>
                )}
              </Button>
            </>
          )}
          <ArrowRight
            size={15}
            className="text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all hidden sm:block flex-shrink-0"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 sm:px-4 lg:px-8 mx-auto max-w-7xl w-full py-6 lg:py-10 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <Badge variant="primary" size="lg" className="mb-3">
            <Users size={12} /> Lobby
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Game Lobby
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Alege o partidă din așteptare, urmărește jocuri live, sau creează-ți propria ta partidă.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          {connected ? (
            <Badge variant="success" size="sm" dot>
              <Wifi size={12} /> Live
            </Badge>
          ) : (
            <Badge variant="danger" size="sm" dot>
              <WifiOff size={12} /> Reconectare...
            </Badge>
          )}
          <Button variant="secondary" href="/play" size="md">
            <Play size={16} /> Quick Match
          </Button>
          <Button href="/play" size="md">
            <Plus size={16} /> Create Game
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    Live Games
                  </CardTitle>
                  <CardDescription>Partide în desfășurare acum</CardDescription>
                </div>
                <Badge variant="success" size="md" dot>
                  {liveGames.length} active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {liveGames.length === 0 ? (
                <EmptyStateRow
                  icon={<Swords size={24} />}
                  title="Nicio partidă live acum"
                  subtitle="Deveniți primul — creați o partidă în /play"
                  action={<Button href="/play" size="sm">Create Game</Button>}
                />
              ) : (
                <div>
                  {liveGames.map((g) => (
                    <GameRow key={g.gameId} g={g} isLive />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
                    <Clock size={18} className="text-amber-500" />
                    Waiting Rooms
                  </CardTitle>
                  <CardDescription>Jocuri deschise pentru oponenți noi</CardDescription>
                </div>
                <Badge variant="warning" size="md" dot>
                  {waitingRooms.length} în așteptare
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {waitingRooms.length === 0 ? (
                <EmptyStateRow
                  icon={<Clock size={24} />}
                  title="Nicio cameră în așteptare"
                  subtitle="Creați-vă propria cameră și așteptați un oponent"
                  action={<Button href="/play" size="sm" variant="secondary">Creează Cameră</Button>}
                />
              ) : (
                <div>
                  {waitingRooms.map((g) => (
                    <GameRow key={g.gameId} g={g} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
              <Users size={18} className="text-brand-500" />
              Online Players
            </CardTitle>
            <CardDescription>
              {online.filter((p) => p.isOnline).length} jucători online
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            {online.length === 0 ? (
              <EmptyStateRow
                icon={<Users size={24} />}
                title="Nimeni online"
                subtitle="Vei apărea aici după login"
              />
            ) : (
              <div className="space-y-0.5 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
                {online.map((p) => (
                  <Link
                    key={p._id || p.username}
                    href="/play"
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <Avatar
                      src={p.avatar}
                      alt={p.username}
                      size="md"
                      status={p.isOnline ? 'online' : 'offline'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {p.username}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>{p.rating || 1500} ELO</span>
                        <span className="opacity-40">·</span>
                        <span>{p.gamesPlayed || 0} meciuri</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Invită la joc"
                    >
                      <Swords size={15} />
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={!!joinModal}
        onClose={() => setJoinModal(null)}
        title={`Intră în joc privat — ${joinModal ? `${Math.floor(joinModal.initialTime / 60)}+${joinModal.increment}` : ''}`}
        description="Introduceți codul de invitație furnizat de gazdă."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setJoinModal(null)}>
              Anulează
            </Button>
            <Button
              variant="primary"
              loading={joinLoading}
              onClick={confirmJoinWithCode}
              disabled={!inviteCode.trim()}
            >
              <Check size={15} /> Intră
            </Button>
          </>
        }
      >
        <Input
          label="Cod invitație"
          placeholder="Ex: AB12CD"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          maxLength={8}
          autoFocus
          icon={<Lock size={16} />}
        />
        {joinModal?.hostUsername && (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <AlertCircle size={14} /> Gazdă: <strong>{joinModal.hostUsername}</strong>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EmptyStateRow({ icon, title, subtitle, action }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto mb-3 inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500">
        {icon}
      </div>
      <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{title}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">{subtitle}</div>
      {action}
    </div>
  );
}
