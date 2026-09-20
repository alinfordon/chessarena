'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Swords,
  Users,
  Clock,
  Shield,
  Lock,
  Unlock,
  Shuffle,
  CircleDot,
  Sparkles,
  Search,
  UserPlus,
  Copy,
  Check,
  X,
  Brain,
  Zap,
  Trophy,
} from 'lucide-react';
import clsx from 'clsx';
import Button from '@/components/ui/Button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { TIME_CONTROLS } from '@/utils/time';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/Toast';
import Input from '@/components/ui/Input';
import Avatar from '@/components/ui/Avatar';
import { LoadingScreen } from '@/components/ui/Loading';

function PlayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { connected, emit, on, off } = useSocket();
  const { toast } = useToast();

  const [mode, setMode] = useState('quick');
  const [timeControl, setTimeControl] = useState(TIME_CONTROLS[5]);
  const [color, setColor] = useState('random');
  const [isPrivate, setIsPrivate] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [botLevel, setBotLevel] = useState(5);

  const [qmState, setQmState] = useState('idle');
  const [qmWait, setQmWait] = useState(0);
  const qmIntervalRef = useState({ current: null })[0];

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useState(null)[0];
  const [selectedOpponent, setSelectedOpponent] = useState(null);

  useEffect(() => {
    const invite = searchParams?.get('invite');
    if (invite) {
      setIsPrivate(true);
      toast({ title: 'Ați deschis un joc privat', description: 'Alegeți setările și creați jocul.', variant: 'info' });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    const unsubs = [];
    unsubs.push(
      on('quick_match:matched', (payload) => {
        if (qmState !== 'searching') return;
        setQmState('idle');
        clearInterval(qmIntervalRef.current);
        toast({
          title: 'Oponent găsit!',
          description: `Joc #${payload.gameId?.slice(0, 6).toUpperCase()}` +
            (payload.side ? ` · Jucați cu ${payload.side === 'white' ? 'alb' : 'negru'}` : ''),
          variant: 'success',
        });
        router.push(`/game/${payload.gameId}`);
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [on, off, qmState, router, toast, qmIntervalRef]);

  const stopQM = () => {
    setQmState('idle');
    setQmWait(0);
    clearInterval(qmIntervalRef.current);
    emit('quick_match:dequeue', {
      initialTime: timeControl.initialTime,
      increment: timeControl.increment,
      colorPreference: color,
    });
    toast({ title: 'Căutare oprită', variant: 'info' });
  };

  const handleQuickMatch = () => {
    if (!authGuard()) return;
    setQmState('searching');
    setQmWait(0);
    clearInterval(qmIntervalRef.current);
    qmIntervalRef.current = setInterval(() => {
      setQmWait((w) => w + 1);
    }, 1000);
    emit(
      'quick_match:enqueue',
      {
        initialTime: timeControl.initialTime,
        increment: timeControl.increment,
        colorPreference: color,
      },
      (ack) => {
        if (!ack?.ok) {
          stopQM();
          toast({ title: ack?.error || 'Eroare înscriere coadă', variant: 'warning' });
        } else {
          toast({ title: 'Înscriu în coadă...', variant: 'info' });
        }
      }
    );
  };

  const authGuard = () => {
    if (!isAuthenticated) {
      toast({ title: 'Trebuie să fiți logat', variant: 'warning' });
      router.push('/login');
      return false;
    }
    return true;
  };

  const handleCreateGame = async (withOpponent = null, withBot = false) => {
    if (!authGuard()) return;
    setCreating(true);
    try {
      const body = {
        initialTime: timeControl.initialTime,
        increment: timeControl.increment,
        colorPreference: color,
        isPrivate: !!isPrivate || !!withOpponent,
      };
      if (withOpponent) body.opponentUserId = withOpponent;
      if (withBot) {
        body.botMode = true;
        body.botLevel = botLevel;
        body.isPrivate = false;
      }
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const data = await res.json();
      setCreating(false);
      if (!data.ok) {
        toast({ title: data.error || 'Creare eșuată', variant: 'warning' });
        return;
      }
      if (body.isPrivate && !withOpponent && !withBot) {
        const g = data;
        const link = `${window.location.origin}/play?invite=${g.inviteCode}`;
        setInviteLink({ link, code: g.inviteCode, gameId: g.gameId });
        toast({ title: 'Joc privat creat!', variant: 'success' });
      } else {
        toast({
          title: withBot ? 'Joc vs AI creat!' : withOpponent ? 'Invitație trimisă!' : 'Joc creat!',
          description: `${Math.floor(timeControl.initialTime / 60)}+${timeControl.increment} · ${data.status}`,
          variant: 'success',
        });
        router.push(`/game/${data.gameId}`);
      }
    } catch (e) {
      setCreating(false);
      toast({ title: 'Eroare rețea', variant: 'warning' });
    }
  };

  const runSearch = (q) => {
    setSearchQuery(q);
    if (searchTimer) clearTimeout(searchTimer);
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setTimeout(() => {
      fetch(`/api/users/search?query=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          setSearchResults(data.ok ? data.users : []);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 250);
  };

  const copy = () => {
    if (!inviteLink?.link) return;
    navigator.clipboard?.writeText(inviteLink.link).then(() => {
      setCopied(true);
      toast({ title: 'Link copiat!', variant: 'success' });
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const colorOptions = [
    { id: 'white', label: 'Alb', icon: CircleDot, cls: 'text-slate-900 bg-white border-slate-300' },
    { id: 'random', label: 'Random', icon: Shuffle, cls: 'text-brand-600 bg-brand-50 border-brand-200 dark:bg-brand-950/40 dark:border-brand-800/40 dark:text-brand-400' },
    { id: 'black', label: 'Negru', icon: CircleDot, cls: 'text-white bg-slate-900 border-slate-700' },
  ];

  const TCGrid = ({ small = false }) => (
    <div className={`grid grid-cols-5 gap-2 sm:gap-3`}>
      {TIME_CONTROLS.map((tc) => {
        const active = timeControl.label === tc.label;
        return (
          <button
            key={tc.label}
            type="button"
            onClick={() => setTimeControl(tc)}
            className={clsx(
              'p-2.5 sm:p-3 rounded-xl border text-center font-bold transition-all text-sm',
              active
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 shadow-sm shadow-brand-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
            )}
          >
            <div>{tc.label}</div>
            {!small && (
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 opacity-70">
                {Math.floor(tc.initialTime / 60)}m + {tc.increment}s
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const ColorPicker = () => (
    <div className="grid grid-cols-3 gap-3">
      {colorOptions.map((opt) => {
        const active = color === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setColor(opt.id)}
            className={clsx(
              'p-4 rounded-xl border-2 transition-all',
              active
                ? 'border-brand-500 ring-2 ring-brand-500/20'
                : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
            )}
          >
            <div className={clsx('mx-auto h-10 w-10 rounded-lg flex items-center justify-center border', opt.cls)}>
              <opt.icon size={18} />
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {opt.label}
            </div>
          </button>
        );
      })}
    </div>
  );

  const botLevelInfo = useMemo(() => {
    const infos = [
      { elo: 800, label: 'Începător', desc: 'Mutări simple, greșeli frecvente' },
      { elo: 950, label: 'Amator', desc: 'Înțelege regulile, capturează uneori' },
      { elo: 1100, label: 'Intermediar', desc: 'Evită capcanele simple' },
      { elo: 1250, label: 'Club', desc: 'Strategie de bază, dezvoltă piese' },
      { elo: 1400, label: 'Club Avansat', desc: 'Capturează aproape întotdeauna' },
      { elo: 1550, label: 'Categorie 4', desc: 'Joc solid, cateva greșeli' },
      { elo: 1700, label: 'Categorie 3', desc: 'Atacuri și apărări clare' },
      { elo: 1850, label: 'Categorie 2', desc: 'Precizie bună, planificare' },
      { elo: 2000, label: 'Categorie 1 (Expert)', desc: 'Mutări puternice, rareori greșeli' },
      { elo: 2200, label: 'Maestru (CM)', desc: 'Strategie avansată, precisie mare' },
    ];
    return infos[Math.max(0, Math.min(9, botLevel - 1))];
  }, [botLevel]);

  const BotLevelPicker = () => (
    <div>
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => {
          const active = botLevel === lv;
          return (
            <button
              key={lv}
              type="button"
              onClick={() => setBotLevel(lv)}
              className={clsx(
                'w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-2 font-bold transition-all text-sm sm:text-base',
                active
                  ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 text-purple-700 dark:text-purple-400 shadow-sm shadow-purple-500/20 ring-2 ring-purple-500/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              )}
              title={botLevelInfo.desc}
            >
              {lv}
            </button>
          );
        })}
      </div>
      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50/70 to-pink-50/70 dark:from-purple-950/30 dark:to-pink-950/20 border border-purple-200/50 dark:border-purple-800/40">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex-shrink-0">
            {botLevel <= 3 ? <Zap size={18} /> : botLevel <= 7 ? <Brain size={18} /> : <Trophy size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Nivel {botLevel} · {botLevelInfo.label}
              </span>
              <Badge variant="purple" size="sm">
                ~{botLevelInfo.elo} Elo
              </Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {botLevelInfo.desc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const VisibilityPicker = () => (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => setIsPrivate(false)}
        className={clsx(
          'p-4 rounded-xl border-2 transition-all text-left',
          !isPrivate
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-2 ring-brand-500/10'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
        )}
      >
        <Unlock size={20} className={clsx('mb-2', !isPrivate ? 'text-brand-500' : 'text-slate-400')} />
        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Public</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Oricine poate intra din Lobby</div>
      </button>
      <button
        type="button"
        onClick={() => setIsPrivate(true)}
        className={clsx(
          'p-4 rounded-xl border-2 transition-all text-left',
          isPrivate
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-2 ring-brand-500/10'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
        )}
      >
        <Lock size={20} className={clsx('mb-2', isPrivate ? 'text-brand-500' : 'text-slate-400')} />
        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Privat</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Doar cu cod de invitație</div>
      </button>
    </div>
  );

  return (
    <div className="flex-1 px-3 sm:px-4 lg:px-8 mx-auto max-w-6xl w-full py-6 lg:py-10 animate-fade-in">
      <div className="mb-6 lg:mb-8 text-center">
        <Badge variant="primary" size="lg" className="mb-3">
          <Swords size={12} /> Play Chess
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Începe următoarea ta partidă
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
          Quick Match cu oponent aleatoriu, joc Custom cu setări detaliate, sau invită un prieten.
        </p>
      </div>

      <Tabs defaultValue="quick" value={mode} onValueChange={setMode}>
        <div className="flex justify-center mb-6 lg:mb-8">
          <TabsList>
            <TabsTrigger value="quick">
              <Sparkles size={14} /> Quick Match
            </TabsTrigger>
            <TabsTrigger value="custom">
              <Shield size={14} /> Custom
            </TabsTrigger>
            <TabsTrigger value="invite">
              <Users size={14} /> Invite Friend
            </TabsTrigger>
            <TabsTrigger value="bot">
              <Brain size={14} /> Play vs AI
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="quick">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Quick Match</CardTitle>
              <CardDescription>Găsește un oponent instant după rating</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Clock size={14} /> Time Control
                </h3>
                <TCGrid />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Culoare</h3>
                <ColorPicker />
              </div>
              {qmState === 'searching' && (
                <div className="p-4 rounded-xl border border-brand-300/40 dark:border-brand-700/40 bg-brand-50 dark:bg-brand-950/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-3 w-3">
                      <span className="absolute inset-0 rounded-full bg-brand-500 animate-ping opacity-75" />
                      <span className="relative rounded-full h-3 w-3 bg-brand-500 block" />
                    </div>
                    <div>
                      <div className="font-semibold text-brand-700 dark:text-brand-400">Caut oponent...</div>
                      <div className="text-xs text-brand-600/70 dark:text-brand-400/70">
                        Așteptare: <strong className="tabular-nums">{qmWait}s</strong> · Rating ±300, după 30s ±1000
                      </div>
                    </div>
                  </div>
                  <Button variant="danger" size="sm" onClick={stopQM}>
                    <X size={14} /> Anulează
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter>
              {qmState === 'searching' ? (
                <Button size="lg" disabled className="w-full">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute rounded-full h-3 w-3 bg-white/80 animate-ping" />
                      <span className="relative rounded-full h-3 w-3 bg-white block" />
                    </span>
                    Caut... {qmWait}s
                  </div>
                </Button>
              ) : (
                <Button size="lg" loading={creating} onClick={handleQuickMatch} className="w-full" disabled={!connected}>
                  {!connected ? (
                    <>Conectare...</>
                  ) : (
                    <>
                      <Users size={18} /> Găsește Oponent
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="custom">
          <Card className="max-w-2xl mx-auto">
            {inviteLink ? (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check size={20} className="text-emerald-500" /> Joc privat creat
                  </CardTitle>
                  <CardDescription>
                    Distribuie codul de invitație prietenului tău.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-brand-50 to-purple-50 dark:from-brand-950/30 dark:to-purple-950/20 border border-brand-200/50 dark:border-brand-800/40">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cod invitație</div>
                    <div className="font-mono text-2xl font-black tracking-widest text-brand-700 dark:text-brand-400 mb-3">
                      {inviteLink.code}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Link</div>
                    <div className="flex items-center gap-2 mb-3">
                      <Input value={inviteLink.link} readOnly className="!text-xs !font-mono" />
                      <Button size="md" variant="secondary" onClick={copy} className="flex-shrink-0">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copiat' : 'Copiază'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setInviteLink(null)}>
                      Creează alt joc
                    </Button>
                    <Button className="flex-1" href={`/game/${inviteLink.gameId}`}>
                      Intră în joc <Swords size={15} />
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Custom Game</CardTitle>
                  <CardDescription>Control complet asupra setărilor jocului</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Clock size={14} /> Time Control
                    </h3>
                    <TCGrid />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Culoare ta</h3>
                    <ColorPicker />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Vizibilitate</h3>
                    <VisibilityPicker />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button size="lg" loading={creating} onClick={() => handleCreateGame(null)} className="w-full">
                    <Swords size={18} /> Creează Joc
                  </Button>
                </CardFooter>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Invite Friend</CardTitle>
              <CardDescription>
                Caută un prieten după nume și trimite-i o invitație privată.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 block">
                  Caută jucător
                </label>
                <div className="relative">
                  <Input
                    placeholder="Scrie minim 2 caractere..."
                    value={searchQuery}
                    onChange={(e) => runSearch(e.target.value)}
                    icon={<Search size={16} />}
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-brand-500 animate-spin" />
                    </div>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-64 overflow-y-auto scrollbar-thin bg-white dark:bg-slate-900/60 shadow-lg z-10 relative">
                    {searchResults.map((p) => {
                      const selected = selectedOpponent?._id === p._id;
                      return (
                        <button
                          type="button"
                          key={p._id}
                          onClick={() => setSelectedOpponent(p)}
                          className={clsx(
                            'w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0',
                            selected && 'bg-brand-50 dark:bg-brand-950/30'
                          )}
                        >
                          <Avatar
                            src={p.avatar}
                            alt={p.username}
                            size="md"
                            status={p.isOnline ? 'online' : 'offline'}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {p.username}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Rating {p.rating || 1500}
                            </div>
                          </div>
                          {selected && (
                            <Badge variant="primary" size="sm">
                              <Check size={12} /> Selectat
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <div className="mt-2 text-center p-4 text-xs text-slate-500 dark:text-slate-400">
                    Niciun rezultat.
                  </div>
                )}
                {selectedOpponent && (
                  <div className="mt-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200/50 dark:border-brand-800/40 flex items-center gap-3">
                    <Avatar
                      src={selectedOpponent.avatar}
                      alt={selectedOpponent.username}
                      size="md"
                      status={selectedOpponent.isOnline ? 'online' : 'offline'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-brand-800 dark:text-brand-300 truncate">
                        Invitat: <strong>{selectedOpponent.username}</strong>
                      </div>
                      <div className="text-xs text-brand-700/70 dark:text-brand-300/70">
                        Vei juca cu {color === 'random' ? 'culoare random' : color === 'white' ? 'alb' : 'negru'}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedOpponent(null)}>
                      <X size={14} />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Clock size={14} /> Time Control
                </h3>
                <TCGrid small />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Culoarea ta</h3>
                <ColorPicker />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                size="lg"
                loading={creating}
                onClick={() => handleCreateGame(selectedOpponent?._id)}
                className="w-full"
                disabled={!selectedOpponent}
              >
                <UserPlus size={18} /> Trimite Invitație
              </Button>
              <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                Prietenul tău va primi notificare în aplicație, iar jocul va fi privat și gata de început.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="bot">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain size={18} className="text-purple-500" /> Joacă împotriva AI-ului
              </CardTitle>
              <CardDescription>
                Alege nivelul de dificultate pentru Stockfish Bot și începe să te joci imediat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Trophy size={14} className="text-amber-500" /> Nivel Stockfish
                </h3>
                <BotLevelPicker />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Clock size={14} /> Time Control
                </h3>
                <TCGrid small />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Culoarea ta</h3>
                <ColorPicker />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                size="lg"
                loading={creating}
                onClick={() => handleCreateGame(null, true)}
                className="w-full gradient-bg hover:brightness-110"
              >
                <Swords size={18} /> Începe Partidă vs AI
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PlayClient() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]"><LoadingScreen label="Se încarcă..." /></div>}>
      <PlayInner />
    </Suspense>
  );
}
