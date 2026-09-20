'use client';

import {
  Swords,
  ArrowLeft,
  Flag,
  Handshake,
  RotateCcw,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Maximize,
  Send,
  Crown,
  Eye,
  XCircle,
  Check,
  Clock,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  Play as PlayIcon,
  Pause as PauseIcon,
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import clsx from 'clsx';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import { LoadingScreen, Spinner } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import ChessBoard from '@/components/chess/ChessBoard';
import MoveList from '@/components/chess/MoveList';
import useGame from '@/hooks/useGame';
import useWebRTC from '@/hooks/useWebRTC';
import { useAuth } from '@/hooks/useAuth';
import { formatTime } from '@/utils/time';
import { timeControlToCategory } from '@/utils/chess';

export default function GameClient({ gameId }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const game = useGame(gameId);
  const webrtc = useWebRTC(gameId);
  const {
    state,
    clocks,
    messages,
    finished,
    drawOffer,
    rematchOffer,
    error,
    clearError,
    joining,
    connected,
    spectator,
    isCheck,
    checkSquare,
    moves,
    replayIndex,
    setReplayIndex,
    goStart,
    goEnd,
    goNext,
    goPrev,
    isReplay,
    replayFen,
    lastMove,
    makeMove,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    offerRematch,
    sendChatMessage,
    userId,
  } = game;

  const [initial, setInitial] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState(null);

  const [newMessage, setNewMessage] = useState('');
  const chatRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  const [confirmResign, setConfirmResign] = useState(false);
  const [finishModal, setFinishModal] = useState(false);
  const [drawModal, setDrawModal] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const autoplayRef = useRef(null);

  useEffect(() => {
    if (!gameId) return undefined;
    let cancelled = false;
    setInitialLoading(true);
    fetch(`/api/games/${gameId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) {
          setInitialError(data.error || 'Joc negăsit');
        } else {
          setInitial(data.game);
        }
      })
      .catch((e) => !cancelled && setInitialError(e.message))
      .finally(() => !cancelled && setInitialLoading(false));
    return () => { cancelled = true; };
  }, [gameId]);

  useEffect(() => {
    if (!finished || !initial) return undefined;
    if (initial.status === 'finished') return undefined;
    const t = setTimeout(() => setFinishModal(true), 700);
    return () => clearTimeout(t);
  }, [finished, initial]);

  useEffect(() => {
    if (drawOffer && drawOffer !== userId) {
      setDrawModal(true);
    }
  }, [drawOffer, userId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: 9999, behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (error) {
      toast({ title: error, variant: 'warning' });
      const t = setTimeout(clearError, 3500);
      return () => clearTimeout(t);
    }
  }, [error, toast, clearError]);

  useEffect(() => {
    if (remoteVideoRef.current && webrtc.remoteStream) {
      remoteVideoRef.current.srcObject = webrtc.remoteStream;
    }
  }, [webrtc.remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && webrtc.localStream) {
      localVideoRef.current.srcObject = webrtc.localStream;
    }
  }, [webrtc.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !webrtc.speakerOn;
    }
  }, [webrtc.speakerOn]);

  // Autoplay 1 move / 800ms
  useEffect(() => {
    if (!autoplay) {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
      return;
    }
    if (!moves.length) return;
    autoplayRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        const next = (prev === null ? 0 : prev + 1);
        if (next >= moves.length) {
          setAutoplay(false);
          return prev;
        }
        return next;
      });
    }, 800);
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [autoplay, moves.length, setReplayIndex]);

  const merged = useMemo(() => ({ ...(initial || {}), ...(state || {}) }), [initial, state]);

  const tcLabel = useMemo(() => {
    const t = merged.initialTime ?? 300;
    const i = merged.increment ?? 0;
    const mins = Math.floor(t / 60);
    return `${mins}+${i}`;
  }, [merged.initialTime, merged.increment]);

  const playerIdOf = (player, playerId) => {
    if (player && typeof player === 'object' && player._id) return String(player._id);
    if (playerId && String(playerId) !== '[object Object]') return String(playerId);
    if (typeof player === 'string' && player !== '[object Object]') return player;
    return null;
  };

  const orientation = useMemo(() => {
    const uid = userId ? String(userId) : null;
    if (!uid) return 'white';
    const whiteId = playerIdOf(merged.whitePlayer, merged.whitePlayerId);
    const blackId = playerIdOf(merged.blackPlayer, merged.blackPlayerId);
    if (whiteId && whiteId === uid) return 'white';
    if (blackId && blackId === uid) return 'black';
    return 'white';
  }, [merged.whitePlayerId, merged.blackPlayerId, merged.whitePlayer, merged.blackPlayer, userId]);

  const hasBothPlayers = Boolean(
    (merged.whiteUsername || merged.whitePlayer) &&
    (merged.blackUsername || merged.blackPlayer)
  );
  const isLive = merged.status === 'playing' || (hasBothPlayers && merged.status === 'waiting');
  const disabled = isReplay || spectator || !isLive || !connected;

  const white = {
    id: merged.whitePlayerId,
    username: merged.whiteUsername || merged.whitePlayer?.username || 'Alb',
    rating: merged.whiteRating || merged.whitePlayer?.rating,
    avatar: merged.whitePlayer?.avatar || null,
    delta: merged.ratingDeltaWhite,
  };
  const black = {
    id: merged.blackPlayerId,
    username: merged.blackUsername || merged.blackPlayer?.username || 'Negru',
    rating: merged.blackRating || merged.blackPlayer?.rating,
    avatar: merged.blackPlayer?.avatar || null,
    delta: merged.ratingDeltaBlack,
  };

  const myTurn =
    isLive &&
    !finished &&
    ((orientation === 'white' && clocks.turn === 'w') ||
      (orientation === 'black' && clocks.turn === 'b'));
  const oppPlayer = orientation === 'white' ? black : white;
  const mePlayer = orientation === 'white' ? white : black;
  const oppTime = orientation === 'white' ? clocks.blackTime : clocks.whiteTime;
  const meTime = orientation === 'white' ? clocks.whiteTime : clocks.blackTime;
  const lastSan = moves.length
    ? moves[replayIndex === null ? moves.length - 1 : replayIndex]?.san
    : null;

  const category = timeControlToCategory(merged.initialTime ?? 300);

  function handleResignConfirmed() {
    setConfirmResign(false);
    resign();
    toast({ title: 'Ați abandonat partida', variant: 'warning' });
  }

  function handleSendMsg(e) {
    e.preventDefault();
    const msg = newMessage.trim();
    if (!msg) return;
    sendChatMessage(msg);
    setNewMessage('');
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    else if (e.key === 'Home') { e.preventDefault(); goStart(); }
    else if (e.key === 'End') { e.preventDefault(); goEnd(); }
  }

  const TerminationLabel = ({ t }) => {
    const map = {
      checkmate: 'Șah mat',
      resignation: 'Abandon',
      timeout: 'Timp expirat',
      draw_agreement: 'Remiză acordată',
      stalemate: 'Pat',
      threefold: 'Repetiție triplă',
      fifty_moves: 'Regula celor 50 de mutări',
      insufficient: 'Material insuficient',
      aborted: 'Abandonată',
    };
    return <span>{map[t] || t || '—'}</span>;
  };

  if (initialLoading && !initial) {
    return (
      <div className="min-h-[70vh]">
        <LoadingScreen label="Se încarcă partida..." />
      </div>
    );
  }

  if (initialError && !initial) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center animate-fade-in">
        <div className="p-6 rounded-2xl border border-red-200/60 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
          <XCircle className="mx-auto mb-3 text-red-500" size={48} />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Eroare încărcare partidă
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
            {initialError}
          </p>
          <Button href="/lobby" variant="primary">
            <ArrowLeft size={16} /> Înapoi la Lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-0 w-full px-2 py-1.5 lg:px-2.5 lg:h-[calc(100dvh-4rem)] animate-fade-in"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button variant="ghost" size="sm" href="/lobby" className="!h-7 !px-2">
            <ArrowLeft size={14} /> Lobby
          </Button>
          <span className="hidden sm:inline text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
            {white.username} <span className="text-slate-300 dark:text-slate-600">vs</span> {black.username}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <Badge variant="primary" size="sm">{tcLabel} · {category.label}</Badge>
          {spectator && <Badge variant="purple" size="sm"><Eye size={12} /> Spectator</Badge>}
          {connected ? (
            <Badge variant="success" size="sm" dot>Live</Badge>
          ) : (
            <Badge variant="danger" size="sm" dot>Offline</Badge>
          )}
          {joining && (
            <Badge variant="warning" size="sm"><Spinner size="sm" className="!h-3 !w-3 !border" /> Conectare</Badge>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(240px,1fr)_minmax(0,1.35fr)_minmax(240px,1fr)] gap-2 items-stretch">
        <aside className="order-2 lg:order-1 flex flex-col gap-1.5 min-h-0 overflow-hidden lg:h-0 lg:min-h-full">
          <PlayerStrip
            player={oppPlayer}
            side={orientation === 'white' ? 'black' : 'white'}
            active={isLive && !finished && !myTurn}
            ended={!!finished}
            time={oppTime}
            delta={oppPlayer.delta}
          />

          <TurnBanner
            waiting={!spectator && !isLive && !finished}
            finished={finished}
            myTurn={myTurn}
            isCheck={isCheck}
            spectator={spectator}
            opponentName={oppPlayer.username}
            lastSan={lastSan}
            whiteName={white.username}
            blackName={black.username}
            onShowResult={() => setFinishModal(true)}
          />

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 px-2.5 py-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ultima mutare</div>
                <div className="font-mono text-xl font-black text-slate-900 dark:text-white truncate leading-tight">
                  {lastSan || '—'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mutări</div>
                <div className="text-xl font-black tabular-nums leading-tight">{moves.length}</div>
              </div>
            </div>
            {merged.isPrivate && merged.inviteCode && (
              <Badge variant="warning" size="sm" className="mt-1.5">
                <Eye size={10} /> Privat {merged.inviteCode}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <PlayerStrip
              player={mePlayer}
              side={orientation === 'white' ? 'white' : 'black'}
              me={!spectator}
              active={isLive && !finished && myTurn}
              ended={!!finished}
              time={meTime}
              delta={mePlayer.delta}
            />

            <div className="flex gap-1">
              <Button
                variant="danger"
                size="sm"
                className="!h-7 !px-2 flex-1"
                disabled={disabled || spectator || isReplay}
                onClick={() => setConfirmResign(true)}
              >
                <Flag size={12} /> Abandon
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="!h-7 !px-2 flex-1"
                disabled={disabled || spectator || isReplay}
                onClick={() => {
                  offerDraw();
                  toast({ title: 'Oferă remiză — trimisă', variant: 'info' });
                }}
              >
                <Handshake size={12} /> Remiză
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="!h-7 !px-2"
                disabled={!finished}
                onClick={() => {
                  offerRematch();
                  toast({ title: 'Cerere revanșă trimisă', variant: 'info' });
                }}
              >
                <RotateCcw size={12} />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-0.5">
              <Button variant="ghost" size="iconSm" className="!h-7 !w-7" onClick={goStart} disabled={!moves.length} title="Început (Home)"><ChevronsLeft size={14} /></Button>
              <Button variant="ghost" size="iconSm" className="!h-7 !w-7" onClick={goPrev} disabled={!moves.length} title="Înapoi (←)"><SkipBack size={14} /></Button>
              <Button variant={autoplay ? 'secondary' : 'ghost'} size="iconSm" className="!h-7 !w-7" onClick={() => setAutoplay((a) => !a)} disabled={!moves.length} title="Autoplay">
                {autoplay ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
              </Button>
              <Button variant="ghost" size="iconSm" className="!h-7 !w-7" onClick={goNext} disabled={!moves.length} title="Înainte (→)"><SkipForward size={14} /></Button>
              <Button variant="ghost" size="iconSm" className="!h-7 !w-7" onClick={goEnd} disabled={!moves.length} title="Live (End)"><ChevronsRight size={14} /></Button>
            </div>
          </div>

          <MoveList
            moves={moves}
            currentIndex={replayIndex}
            onMoveClick={setReplayIndex}
            className="flex-1 min-h-0"
          />
        </aside>

        <div className="order-1 lg:order-2 min-h-0 min-w-0">
          <div className="relative w-full mx-auto aspect-square max-w-[min(100%,calc(100dvh-5.5rem))]">
            <ChessBoard
              fen={replayFen || merged.fen}
              orientation={orientation}
              onMove={makeMove}
              lastMove={lastMove}
              disabled={disabled}
              isCheck={isCheck}
              checkSquare={checkSquare}
              className="!max-w-none !mx-0"
            />
            {isReplay && (
              <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-lg pointer-events-none">
                Revizuire
              </div>
            )}
            {!spectator && !isLive && !finished && (
              <div className="absolute inset-0 rounded-lg bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                <div className="px-5 py-3 rounded-xl bg-amber-500 text-white text-center shadow-2xl">
                  <div className="text-lg font-black tracking-tight">Aștept oponentul</div>
                  <div className="text-xs font-semibold opacity-90 mt-0.5">Partida pornește când intră al doilea jucător</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="order-3 flex flex-col gap-1.5 min-h-0 overflow-hidden lg:h-0 lg:min-h-full">
          <Card className="overflow-hidden flex-1 min-h-0 flex flex-col">
            <CardHeader className="!p-2 shrink-0">
              <CardTitle className="flex items-center justify-between !text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Crown size={14} className="text-amber-500 shrink-0" />
                  <span className="truncate">{(orientation === 'white' ? black : white).username}</span>
                </div>
                {webrtc.connectionState === 'connected' ? (
                  <Badge variant="success" size="sm" dot>HD</Badge>
                ) : webrtc.connectionState === 'failed' || webrtc.iceState === 'failed' ? (
                  <Badge variant="danger" size="sm" dot>Eroare</Badge>
                ) : webrtc.connectionState === 'connecting' || webrtc.iceState === 'checking' ? (
                  <Badge variant="warning" size="sm" dot>…</Badge>
                ) : !webrtc.isReady && !webrtc.remoteStream ? (
                  <Badge variant="default" size="sm">Off</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 !p-2 flex-1 min-h-0 flex flex-col">
              <div className="relative flex-1 min-h-[140px] rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800">
                {webrtc.remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    playsInline
                    autoPlay
                    muted={!webrtc.speakerOn}
                    controls={false}
                    className="w-full h-full object-cover bg-slate-900"
                  />
                ) : (
                  <div className="text-center px-2">
                    <Avatar
                      src={(orientation === 'white' ? black : white).avatar}
                      alt={(orientation === 'white' ? black : white).username}
                      size="lg"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {webrtc.connectionState === 'connecting' || webrtc.iceState === 'checking'
                        ? 'Se stabilește conexiunea...'
                        : 'Video oprit'}
                    </p>
                  </div>
                )}
                {webrtc.localStream && (
                  <video
                    ref={localVideoRef}
                    playsInline
                    autoPlay
                    muted
                    controls={false}
                    className="absolute bottom-1.5 left-1.5 w-16 h-11 object-cover rounded border border-white/30 bg-slate-950 shadow-xl"
                  />
                )}
                {!webrtc.localStream && webrtc.cameraOn && (
                  <div className="absolute bottom-1.5 left-1.5 w-16 h-11 bg-gradient-to-br from-slate-700 to-slate-900 rounded border border-white/20 flex items-center justify-center shadow-xl">
                    <Avatar src={user?.avatar} alt={user?.username} size="sm" />
                  </div>
                )}
                {webrtc.error && (
                  <div className="absolute top-1.5 left-1.5 right-1.5 px-2 py-0.5 rounded-md bg-red-900/80 text-red-100 text-[10px] font-medium text-center">
                    {webrtc.error}
                  </div>
                )}
              </div>

              {!spectator && !webrtc.remoteStream && webrtc.connectionState !== 'connecting' && webrtc.iceState !== 'checking' && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full !h-8"
                  onClick={async () => {
                    const opponentId = orientation === 'white' ? merged.blackPlayerId : merged.whitePlayerId;
                    if (opponentId) {
                      try {
                        await webrtc.getLocalMedia(true, true);
                        webrtc.offerCall(opponentId);
                        toast({ title: 'Apel video pornit', variant: 'info' });
                      } catch (e) {
                        toast({ title: e.message || 'Eroare la pornirea camerei', variant: 'danger' });
                      }
                    }
                  }}
                >
                  <Video size={13} /> Pornește video
                </Button>
              )}

              <div className={clsx(
                'grid gap-1',
                (webrtc.connectionState === 'failed' || webrtc.iceState === 'failed') ? 'grid-cols-5' : 'grid-cols-4'
              )}>
                <button
                  onClick={webrtc.toggleMicrophone}
                  className={clsx(
                    'p-1.5 rounded-md flex items-center justify-center transition-all',
                    webrtc.micOn
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                  )}
                  title={webrtc.micOn ? 'Microfon off' : 'Microfon on'}
                >
                  {webrtc.micOn ? <Mic size={14} /> : <MicOff size={14} />}
                </button>
                <button
                  onClick={webrtc.toggleCamera}
                  className={clsx(
                    'p-1.5 rounded-md flex items-center justify-center transition-all',
                    webrtc.cameraOn
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                  )}
                  title={webrtc.cameraOn ? 'Camera off' : 'Camera on'}
                >
                  {webrtc.cameraOn ? <Video size={14} /> : <VideoOff size={14} />}
                </button>
                <button
                  onClick={webrtc.toggleSpeaker}
                  className={clsx(
                    'p-1.5 rounded-md flex items-center justify-center transition-all',
                    webrtc.speakerOn
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                  )}
                  title={webrtc.speakerOn ? 'Boxe off' : 'Boxe on'}
                >
                  {webrtc.speakerOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
                <button
                  onClick={() => {
                    const el = document.documentElement;
                    if (!document.fullscreenElement) el.requestFullscreen?.();
                    else document.exitFullscreen?.();
                  }}
                  className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"
                  title="Ecran complet"
                >
                  <Maximize size={14} />
                </button>
                {(webrtc.connectionState === 'failed' || webrtc.iceState === 'failed') && (
                  <button
                    onClick={() => {
                      webrtc.reconnect();
                      toast({ title: 'Reconectare video...', variant: 'info' });
                    }}
                    className="p-1.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center"
                    title="Reconectare"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col min-h-0 flex-1">
            <CardHeader className="!p-2 shrink-0">
              <CardTitle className="!text-sm">Chat</CardTitle>
            </CardHeader>
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1.5 scrollbar-thin min-h-0"
            >
              {messages.length === 0 ? (
                <div className="p-3 text-center text-[11px] text-slate-400 dark:text-slate-500 italic">
                  Să înceapă conversația. GL HF!
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.userId === user?._id || m.username === user?.username;
                  return (
                    <div key={i} className={clsx('flex', isMe ? 'justify-end' : 'justify-start')}>
                      <div
                        className={clsx(
                          'max-w-[85%] px-2.5 py-1.5 rounded-xl text-xs shadow-sm',
                          isMe
                            ? 'gradient-bg text-white rounded-br-md'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md'
                        )}
                      >
                        {!isMe && (
                          <div className="text-[10px] font-bold opacity-80 mb-0.5">{m.username}</div>
                        )}
                        <div className="break-words">{m.text || m.message}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-1.5 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <form onSubmit={handleSendMsg} className="flex gap-1.5">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Mesaj..."
                  maxLength={500}
                  disabled={spectator}
                  className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 disabled:opacity-60"
                />
                <Button
                  type="submit"
                  size="iconSm"
                  variant="primary"
                  className="!h-8 !w-8"
                  disabled={!newMessage.trim() || spectator}
                >
                  <Send size={13} />
                </Button>
              </form>
            </div>
          </Card>
        </aside>
      </div>

      <Modal
        isOpen={confirmResign}
        onClose={() => setConfirmResign(false)}
        title="Confirmați abandonul?"
        description="Odată abandonată, partida se consideră pierdută și rating-ul se actualizează."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmResign(false)}>
              Renunță
            </Button>
            <Button variant="danger" onClick={handleResignConfirmed}>
              Abandon
            </Button>
          </>
        }
      />

      <Modal
        isOpen={drawModal}
        onClose={() => setDrawModal(false)}
        title="Ofertă de remiză"
        description={`${
          (drawOffer === white.id ? white : black).username
        } oferă remiză. Acceptați?`}
        size="sm"
        footer={
          <>
            <Button variant="danger" onClick={() => { declineDraw(); setDrawModal(false); }}>
              Refuză
            </Button>
            <Button variant="success" onClick={() => { acceptDraw(); setDrawModal(false); }}>
              <Check size={16} /> Accept
            </Button>
          </>
        }
      />

      <Modal
        isOpen={finishModal}
        onClose={() => setFinishModal(false)}
        title={
          finished?.result === 'draw'
            ? 'Remiză!'
            : (finished?.result === 'white' ? 'Victorie — Alb!' : 'Victorie — Negru!')
        }
        description={
          <>
            <div className="mb-1">
              Mod terminare: <TerminationLabel t={finished?.termination} />.
            </div>
            {(white.delta !== undefined || black.delta !== undefined) && (
              <div className="mt-2 space-y-1 text-sm">
                {[white, black].map((p) => {
                  const d = p.delta;
                  if (d === undefined || d === null) return null;
                  const sign = d > 0 ? '+' : '';
                  const cat = category.label;
                  return (
                    <div key={p.id} className="flex justify-between gap-3">
                      <span className="text-slate-600 dark:text-slate-300">{p.username}</span>
                      <span className={clsx(
                        'font-semibold tabular-nums',
                        d > 0 ? 'text-emerald-600 dark:text-emerald-400' : d < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'
                      )}>
                        {sign}{d} {cat}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" href="/lobby">
              <ArrowLeft size={16} /> Lobby
            </Button>
            <Button variant="primary" onClick={() => { goStart(); setFinishModal(false); }}>
              <RotateCcw size={16} /> Revizuire
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                offerRematch();
                setFinishModal(false);
                toast({ title: 'Cerere revanșă trimisă', variant: 'info' });
              }}
            >
              <Swords size={16} /> Revanșă
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="text-center">
            <Avatar src={white.avatar} alt={white.username} size="xl" className="mx-auto mb-2" />
            <div className="font-bold truncate">{white.username}</div>
            <div className="text-xs text-slate-500">{white.rating}</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black text-slate-700 dark:text-slate-200">
              {finished?.result === 'white' ? '1' : finished?.result === 'draw' ? '½' : '0'}
              <span className="text-slate-300 dark:text-slate-600 mx-1">:</span>
              {finished?.result === 'black' ? '1' : finished?.result === 'draw' ? '½' : '0'}
            </div>
            <Badge variant="primary" size="sm" className="mt-2">
              <Clock size={10} /> {tcLabel}
            </Badge>
          </div>
          <div className="text-center">
            <Avatar src={black.avatar} alt={black.username} size="xl" className="mx-auto mb-2" />
            <div className="font-bold truncate">{black.username}</div>
            <div className="text-xs text-slate-500">{black.rating}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TurnBanner({ waiting, finished, myTurn, isCheck, spectator, opponentName, lastSan, whiteName, blackName, onShowResult }) {
  if (finished) {
    const label =
      finished.result === 'draw'
        ? 'Remiză'
        : finished.result === 'white'
          ? `${whiteName || 'Alb'} a câștigat`
          : `${blackName || 'Negru'} a câștigat`;
    return (
      <button
        type="button"
        onClick={onShowResult}
        className="w-full rounded-xl px-2.5 py-2 bg-emerald-600 text-white text-center font-black tracking-wide shadow-lg shadow-emerald-600/30 text-sm"
      >
        {label}
        <span className="block text-[10px] font-semibold opacity-70 mt-0.5">Vezi rezultatul</span>
      </button>
    );
  }
  if (waiting) {
    return (
      <div className="rounded-xl px-2.5 py-2 bg-amber-500 text-white text-center font-black tracking-wide shadow-lg shadow-amber-500/30 text-sm">
        Aștept oponentul...
      </div>
    );
  }
  if (spectator) {
    return (
      <div className="rounded-xl px-2.5 py-1.5 bg-purple-600 text-white text-center font-bold text-sm">
        Mod spectator{lastSan ? ` · ${lastSan}` : ''}
      </div>
    );
  }
  if (myTurn && isCheck) {
    return (
      <div className="rounded-xl px-2.5 py-2 bg-red-600 text-white text-center font-black tracking-wide shadow-lg shadow-red-600/40 animate-pulse">
        ȘAH — Mutarea ta
      </div>
    );
  }
  if (myTurn) {
    return (
      <div className="rounded-xl px-2.5 py-2 bg-emerald-500 text-white text-center font-black tracking-wide shadow-lg shadow-emerald-500/30">
        Mutarea ta
      </div>
    );
  }
  return (
    <div className="rounded-xl px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-center font-bold text-sm">
      Rândul lui {opponentName || 'oponent'}
    </div>
  );
}

function PlayerStrip({ player, side, me, active, ended, time, delta }) {
  const rating = typeof player?.rating === 'number' ? player.rating : 1200;
  const low = typeof time === 'number' && time < 30;
  const critical = typeof time === 'number' && time < 10;

  return (
    <div
      className={clsx(
        'px-2.5 py-2 rounded-xl border transition-all duration-200',
        active
          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
          : 'bg-white/80 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-100',
        active && low && '!bg-red-600 !text-white shadow-red-600/40',
        active && critical && 'animate-pulse'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Avatar
          src={player.avatar}
          alt={player.username}
          size="sm"
          status={active ? 'playing' : 'online'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-black truncate text-sm leading-tight">
              {player.username}
            </span>
            {me && (
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest opacity-60">
                Tu
              </span>
            )}
            {typeof delta === 'number' && (
              <span className={clsx(
                'shrink-0 text-[11px] font-black tabular-nums',
                delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-300' : 'opacity-60'
              )}>
                {delta > 0 ? '+' : ''}{delta}
              </span>
            )}
          </div>
          <div className={clsx('text-[10px] font-semibold', active ? 'opacity-70' : 'text-slate-500 dark:text-slate-400')}>
            {side === 'white' ? 'Alb' : 'Negru'} · {rating} Elo
          </div>
        </div>
      </div>
      <div
        className={clsx(
          'mt-1.5 font-mono font-black tabular-nums leading-none text-center',
          'text-[1.85rem] lg:text-[2.15rem]',
          !active && !ended && 'opacity-50',
          active && critical && 'tracking-tight'
        )}
      >
        {formatTime(typeof time === 'number' ? time : 0)}
      </div>
    </div>
  );
}
