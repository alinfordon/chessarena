'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Wifi,
  WifiOff,
  Eye,
  Award,
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
import ChessClock from '@/components/chess/ChessClock';
import MoveList from '@/components/chess/MoveList';
import useGame from '@/hooks/useGame';
import useWebRTC from '@/hooks/useWebRTC';
import { useAuth } from '@/hooks/useAuth';
import { formatTime } from '@/utils/time';
import { timeControlToCategory } from '@/utils/chess';

export default function GameClient({ gameId }) {
  const router = useRouter();
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
    if (finished) {
      const t = setTimeout(() => setFinishModal(true), 600);
      return () => clearTimeout(t);
    }
  }, [finished]);

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

  const orientation = useMemo(() => {
    const uid = userId ? String(userId) : null;
    if (!uid) return 'white';
    const whiteId = (merged.whitePlayerId ? String(merged.whitePlayerId) : null)
      || (merged.whitePlayer && merged.whitePlayer._id ? String(merged.whitePlayer._id) : null);
    const blackId = (merged.blackPlayerId ? String(merged.blackPlayerId) : null)
      || (merged.blackPlayer && merged.blackPlayer._id ? String(merged.blackPlayer._id) : null);
    if (whiteId && String(whiteId) === uid) return 'white';
    if (blackId && String(blackId) === uid) return 'black';
    return 'white';
  }, [merged.whitePlayerId, merged.blackPlayerId, merged.whitePlayer, merged.blackPlayer, userId]);

  const disabled = isReplay || spectator || merged.status !== 'playing' || !connected;

  const white = {
    id: merged.whitePlayerId,
    username: merged.whiteUsername || 'Alb',
    rating: merged.whiteRating,
    avatar: null,
    delta: merged.ratingDeltaWhite,
  };
  const black = {
    id: merged.blackPlayerId,
    username: merged.blackUsername || 'Negru',
    rating: merged.blackRating,
    avatar: null,
    delta: merged.ratingDeltaBlack,
  };

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
    <div className="flex-1 px-3 sm:px-4 lg:px-8 mx-auto max-w-7xl w-full py-4 lg:py-6 animate-fade-in" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" href="/lobby">
            <ArrowLeft size={16} /> Lobby
          </Button>
          <Badge variant="primary" size="sm">
            #{gameId?.slice(0, 8).toUpperCase() || '—'}
          </Badge>
          <Badge variant="success" size="sm" dot>{tcLabel}</Badge>
          <Badge variant="default" size="sm">{category.label}</Badge>
          {spectator && (
            <Badge variant="purple" size="sm"><Eye size={12} /> Spectator</Badge>
          )}
          {isReplay && (
            <Badge variant="warning" size="sm"><PlayIcon size={12} /> REPLAY Move {(replayIndex === null ? 0 : replayIndex + 1)}/{moves.length}</Badge>
          )}
          {!isReplay && moves.length > 0 && (
            <Badge variant="success" size="sm" dot>LIVE {moves.length} mutări</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge variant="success" size="sm" dot><Wifi size={12} /> Online</Badge>
          ) : (
            <Badge variant="danger" size="sm" dot><WifiOff size={12} /> Reconectare...</Badge>
          )}
          {joining && (
            <Badge variant="warning" size="sm"><Spinner size="sm" className="!h-3 !w-3 !border" /> Se conectează...</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4">
          <PlayerCard
            player={orientation === 'white' ? black : white}
            side={orientation === 'white' ? 'black' : 'white'}
            opponent
            delta={orientation === 'white' ? black.delta : white.delta}
            category={category.key}
            active={
              (orientation === 'white' && clocks.turn === 'b') ||
              (orientation === 'black' && clocks.turn === 'w')
            }
            time={orientation === 'white' ? clocks.blackTime : clocks.whiteTime}
          />

          <ChessClock
            whiteTime={clocks.whiteTime}
            blackTime={clocks.blackTime}
            turn={clocks.turn}
            orientation={orientation}
          />

          <div className="relative">
            <ChessBoard
              fen={replayFen || merged.fen}
              orientation={orientation}
              onMove={makeMove}
              lastMove={lastMove}
              disabled={disabled}
              isCheck={isCheck}
              checkSquare={checkSquare}
            />
            {isReplay && (
              <div className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold uppercase px-2.5 py-1 rounded-lg shadow-lg animate-pulse pointer-events-none">
                Mod Revizuire
              </div>
            )}
          </div>

          {/* Replay Controls */}
          <div className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 rounded-xl p-3 flex flex-wrap gap-2 justify-between items-center">
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="iconSm" onClick={goStart} disabled={!moves.length} title="Inceput (Home)"><ChevronsLeft size={16} /></Button>
              <Button variant="ghost" size="iconSm" onClick={goPrev} disabled={replayIndex === null && !moves.length || moves.length === 0} title="Inapoi (←)"><SkipBack size={16} /></Button>
              <Button variant={autoplay ? 'warning' : 'secondary'} size="sm" onClick={() => setAutoplay(a => !a)} disabled={!moves.length || finished === null && !finished}>
                {autoplay ? <><PauseIcon size={14} className="mr-1.5" /> Pauză</> : <><PlayIcon size={14} className="mr-1.5" /> Autoplay</>}
              </Button>
              <Button variant="ghost" size="iconSm" onClick={goNext} disabled={!moves.length} title="Inainte (→)"><SkipForward size={16} /></Button>
              <Button variant="ghost" size="iconSm" onClick={goEnd} disabled={!moves.length} title="Live (End)"><ChevronsRight size={16} /></Button>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {replayIndex === null ? `Poziția inițială` : `Mutarea ${replayIndex + 1} / ${moves.length}`} · Taste: ← → Home End
            </div>
            {merged.isPrivate && merged.inviteCode && (
              <Badge variant="warning" size="sm" className="gap-1">
                <Eye size={10} /> Privat {merged.inviteCode}
              </Badge>
            )}
          </div>

          <PlayerCard
            player={orientation === 'white' ? white : black}
            side={orientation === 'white' ? 'white' : 'black'}
            delta={orientation === 'white' ? white.delta : black.delta}
            category={category.key}
            me
            active={
              (orientation === 'white' && clocks.turn === 'w') ||
              (orientation === 'black' && clocks.turn === 'b')
            }
            time={orientation === 'white' ? clocks.whiteTime : clocks.blackTime}
          />

          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="danger"
              size="sm"
              disabled={disabled || spectator || isReplay}
              onClick={() => setConfirmResign(true)}
            >
              <Flag size={14} /> Abandon
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || spectator || isReplay}
              onClick={() => {
                offerDraw();
                toast({ title: 'Oferă remiză — trimisă', variant: 'info' });
              }}
            >
              <Handshake size={14} /> Oferă Remiză
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!finished}
              onClick={() => {
                offerRematch();
                toast({ title: 'Cerere revanșă trimisă', variant: 'info' });
              }}
            >
              <RotateCcw size={14} /> Revanșă
            </Button>
            {!spectator && merged.status === 'waiting' && (
              <Badge variant="warning" size="md" dot>
                Aștept oponent...
              </Badge>
            )}
            {finished && (
              <Badge variant="primary" size="md">
                <Award size={12} /> Partidă terminată
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:space-y-5">
          <MoveList moves={moves} currentIndex={replayIndex} onMoveClick={setReplayIndex} className="min-h-[200px]" />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Crown size={16} className="text-amber-500" />
                  {(orientation === 'white' ? black : white).username}
                </div>
                {webrtc.connectionState === 'connected' ? (
                  <Badge variant="success" size="sm" dot>HD Conectat</Badge>
                ) : webrtc.connectionState === 'failed' || webrtc.iceState === 'failed' ? (
                  <Badge variant="danger" size="sm" dot>Conexiune eșuată</Badge>
                ) : webrtc.connectionState === 'connecting' || webrtc.iceState === 'checking' ? (
                  <Badge variant="warning" size="sm" dot>Se conectează...</Badge>
                ) : !webrtc.isReady && !webrtc.remoteStream ? (
                  <Badge variant="default" size="sm">Video off</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800">
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
                  <div className="text-center">
                    <Avatar
                      src={(orientation === 'white' ? black : white).avatar}
                      alt={(orientation === 'white' ? black : white).username}
                      size="xl"
                    />
                    <p className="text-xs text-slate-400 mt-3">
                      {webrtc.connectionState === 'connecting' || webrtc.iceState === 'checking'
                        ? 'Se stabilește conexiunea...'
                        : 'Participantul nu are video pornit'}
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
                    className="absolute bottom-2 left-2 w-24 h-16 object-cover rounded border border-white/30 bg-slate-950 shadow-xl"
                  />
                )}
                {!webrtc.localStream && webrtc.cameraOn && (
                  <div className="absolute bottom-2 left-2 w-24 h-16 bg-gradient-to-br from-slate-700 to-slate-900 rounded border border-white/20 flex items-center justify-center shadow-xl">
                    <Avatar
                      src={user?.avatar}
                      alt={user?.username}
                      size="sm"
                    />
                  </div>
                )}
                {webrtc.error && (
                  <div className="absolute top-2 left-2 right-2 px-2 py-1 rounded-md bg-red-900/80 text-red-100 text-[10px] font-medium text-center">
                    {webrtc.error}
                  </div>
                )}
              </div>

              {!spectator && !webrtc.remoteStream && webrtc.connectionState !== 'connecting' && webrtc.iceState !== 'checking' && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
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
                  <Video size={14} /> Pornește apel video
                </Button>
              )}

              <div className={clsx(
                'grid gap-2',
                (webrtc.connectionState === 'failed' || webrtc.iceState === 'failed') ? 'grid-cols-5' : 'grid-cols-4'
              )}>
                <button
                  onClick={webrtc.toggleMicrophone}
                  className={clsx(
                    'p-2 rounded-lg flex items-center justify-center transition-all',
                    webrtc.micOn
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                  )}
                  title={webrtc.micOn ? 'Microfon off' : 'Microfon on'}
                >
                  {webrtc.micOn ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
                <button
                  onClick={webrtc.toggleCamera}
                  className={clsx(
                    'p-2 rounded-lg flex items-center justify-center transition-all',
                    webrtc.cameraOn
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                  )}
                  title={webrtc.cameraOn ? 'Camera off' : 'Camera on'}
                >
                  {webrtc.cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
                <button
                  onClick={webrtc.toggleSpeaker}
                  className={clsx(
                    'p-2 rounded-lg flex items-center justify-center transition-all',
                    webrtc.speakerOn
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                  )}
                  title={webrtc.speakerOn ? 'Boxe off' : 'Boxe on'}
                >
                  {webrtc.speakerOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                  onClick={() => {
                    const el = document.documentElement;
                    if (!document.fullscreenElement) el.requestFullscreen?.();
                    else document.exitFullscreen?.();
                  }}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"
                  title="Ecran complet"
                >
                  <Maximize size={16} />
                </button>
                {(webrtc.connectionState === 'failed' || webrtc.iceState === 'failed') && (
                  <button
                    onClick={() => {
                      webrtc.reconnect();
                      toast({ title: 'Reconectare video...', variant: 'info' });
                    }}
                    className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center"
                    title="Reconectare"
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col h-[320px] sm:h-[380px]">
            <CardHeader>
              <CardTitle className="text-base">Chat</CardTitle>
            </CardHeader>
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto px-4 py-2 space-y-2 scrollbar-thin"
            >
              {messages.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                  Să înceapă conversația. GL HF!
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.userId === user?._id || m.username === user?.username;
                  return (
                    <div key={i} className={clsx('flex', isMe ? 'justify-end' : 'justify-start')}>
                      <div
                        className={clsx(
                          'max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm',
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
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
              <form onSubmit={handleSendMsg} className="flex gap-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Scrie un mesaj..."
                  maxLength={500}
                  disabled={spectator}
                  className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 disabled:opacity-60"
                />
                <Button
                  type="submit"
                  size="iconSm"
                  variant="primary"
                  disabled={!newMessage.trim() || spectator}
                >
                  <Send size={14} />
                </Button>
              </form>
            </div>
          </Card>
        </div>
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

function PlayerCard({ player, side, me, opponent, active, time, delta, category }) {
  const sideColor = side === 'white' ? 'Alb' : 'Negru';
  const sideBadge = side === 'white' ? 'success' : 'default';
  const catField = category || 'rapidRating';
  const rating =
    typeof player.rating === 'object' && player.rating
      ? player.rating[catField] ?? player.rating.rating ?? 1500
      : player.rating ?? 1500;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar
              src={player.avatar}
              alt={player.username}
              size="lg"
              status={active ? 'playing' : 'online'}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                  {player.username}
                </span>
                <Badge variant={sideBadge} size="sm">{sideColor}</Badge>
                {me && <Badge variant="primary" size="sm">Eu</Badge>}
                {typeof delta === 'number' && (
                  <Badge
                    variant={delta > 0 ? 'success' : delta < 0 ? 'danger' : 'default'}
                    size="sm"
                  >
                    {delta > 0 ? '+' : ''}{delta}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Rating: {rating}
              </div>
            </div>
          </div>
          <div
            className={clsx(
              'rounded-xl px-4 py-2.5 font-mono text-xl font-bold border transition-all tabular-nums',
              active
                ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 text-brand-700 dark:text-brand-400 scale-[1.02] shadow-md'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
              active && typeof time === 'number' && time < 30 &&
                '!bg-red-500 !text-white !border-red-500 !shadow-red-500/30 animate-pulse'
            )}
          >
            <Clock size={14} className="inline mr-1.5 -mt-0.5 opacity-70" />
            {formatTime(typeof time === 'number' ? time : 0)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
