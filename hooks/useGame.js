'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import { createChessInstance } from '@/utils/chess';

export function useGame(gameId) {
  const { connected, emit, on, off } = useSocket();
  const { user } = useAuth();

  const [state, setState] = useState(null);
  const [clocks, setClocks] = useState({ whiteTime: 0, blackTime: 0, turn: 'w' });
  const [messages, setMessages] = useState([]);
  const [finished, setFinished] = useState(null);
  const [drawOffer, setDrawOffer] = useState(null);
  const [rematchOffer, setRematchOffer] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(true);
  const [spectator, setSpectator] = useState(false);
  const [replayIndex, setReplayIndex] = useState(null);

  const joinedRef = useRef(false);

  const moves = state?.moves || [];
  const movesLength = moves.length;

  const resetReplayIfLive = useCallback(() => {
    setReplayIndex((prev) => (prev === movesLength - 1 ? prev : prev));
  }, [movesLength]);

  // Auto jump to live whenever a new move arrives if we were at the last position
  const autoAdvanceRef = useRef(true);
  useEffect(() => {
    if (autoAdvanceRef.current) {
      setReplayIndex(movesLength === 0 ? null : movesLength - 1);
    }
  }, [movesLength]);

  const goToMove = useCallback((idx) => {
    if (!movesLength) return;
    const clamped = Math.max(-1, Math.min(movesLength - 1, idx));
    const actual = clamped === -1 ? null : clamped;
    autoAdvanceRef.current = actual === movesLength - 1;
    setReplayIndex(actual);
  }, [movesLength]);

  const goNext = useCallback(() => {
    if (!movesLength) return;
    setReplayIndex((prev) => {
      const n = prev === null ? 0 : Math.min(movesLength - 1, prev + 1);
      autoAdvanceRef.current = n === movesLength - 1;
      return n;
    });
  }, [movesLength]);

  const goPrev = useCallback(() => {
    if (!movesLength) return;
    setReplayIndex((prev) => {
      autoAdvanceRef.current = false;
      if (prev === null) return null;
      const n = prev - 1;
      return n < 0 ? null : n;
    });
  }, []);

  const goStart = useCallback(() => {
    autoAdvanceRef.current = false;
    setReplayIndex(null);
  }, []);

  const goEnd = useCallback(() => {
    autoAdvanceRef.current = true;
    setReplayIndex(movesLength === 0 ? null : movesLength - 1);
  }, [movesLength]);

  const clearError = useCallback(() => setError(null), []);

  const joinGame = useCallback(() => {
    if (!gameId || joinedRef.current) return;
    joinedRef.current = true;
    setJoining(true);
    emit('game:join', { gameId }, (ack) => {
      setJoining(false);
      if (!ack?.ok) {
        setError(ack?.error || 'Nu se poate intra în joc');
        joinedRef.current = false;
      } else {
        setSpectator(!!ack?.spectator);
      }
    });
  }, [gameId, emit]);

  const leaveGame = useCallback(() => {
    if (!gameId) return;
    emit('game:leave', { gameId });
    joinedRef.current = false;
  }, [gameId, emit]);

  const makeMove = useCallback((from, to, promotion = null) => {
    if (!gameId) return;
    setError(null);
    const opts = { gameId, from, to };
    if (promotion) opts.promotion = promotion;
    emit('game:move', opts, (ack) => {
      if (!ack?.ok) {
        setError(ack?.error || 'Mutare invalidă');
      }
    });
  }, [gameId, emit]);

  const resign = useCallback(() => {
    if (!gameId) return;
    setError(null);
    emit('game:resign', { gameId }, (ack) => {
      if (!ack?.ok) setError(ack?.error || 'Abandon eșuat');
    });
  }, [gameId, emit]);

  const offerDraw = useCallback(() => {
    if (!gameId) return;
    emit('game:offer-draw', { gameId });
  }, [gameId, emit]);

  const acceptDraw = useCallback(() => {
    if (!gameId) return;
    emit('game:accept-draw', { gameId });
    setDrawOffer(null);
  }, [gameId, emit]);

  const declineDraw = useCallback(() => {
    if (!gameId) return;
    emit('game:decline-draw', { gameId });
    setDrawOffer(null);
  }, [gameId, emit]);

  const offerRematch = useCallback(() => {
    if (!gameId) return;
    emit('game:rematch', { gameId });
  }, [gameId, emit]);

  const sendChatMessage = useCallback((text) => {
    if (!gameId || !text?.trim()) return;
    setError(null);
    emit('chat:message', { gameId, text: text.trim() }, (ack) => {
      if (!ack?.ok) setError(ack?.error || 'Mesajul nu a fost trimis');
    });
  }, [gameId, emit]);

  useEffect(() => {
    if (!gameId) return undefined;
    joinGame();

    const unsubs = [];
    const add = (event, handler) => {
      const fn = on(event, handler);
      unsubs.push(fn);
    };

    add('game:state', (payload) => {
      if (payload?.gameId !== gameId) return;
      setState(payload);
      setClocks({
        whiteTime: payload.whiteTime ?? 0,
        blackTime: payload.blackTime ?? 0,
        turn: payload.turn ?? 'w',
      });
      if (payload.status === 'finished') {
        setFinished({ result: payload.result, termination: payload.termination });
      }
    });

    add('game:clock', (payload) => {
      if (payload?.gameId !== gameId) return;
      setClocks({
        whiteTime: payload.whiteTime ?? 0,
        blackTime: payload.blackTime ?? 0,
        turn: payload.turn ?? 'w',
      });
    });

    add('game:finished', (payload) => {
      if (payload?.gameId !== gameId) return;
      setFinished({ result: payload.result, termination: payload.termination });
    });

    add('game:draw-offered', (payload) => {
      if (payload?.gameId !== gameId) return;
      setDrawOffer(payload.byUserId);
    });

    add('game:draw-declined', (payload) => {
      if (payload?.gameId !== gameId) return;
      setDrawOffer(null);
    });

    add('game:rematch-offered', (payload) => {
      if (payload?.gameId !== gameId) return;
      setRematchOffer(payload.byUserId);
    });

    add('chat:history', (payload) => {
      if (payload?.gameId !== gameId) return;
      setMessages(payload.messages || []);
    });

    add('chat:message', (payload) => {
      if (payload?.gameId !== gameId) return;
      setMessages((prev) => [...prev, payload]);
    });

    add('game:error', (payload) => {
      if (payload?.gameId !== gameId) return;
      setError(payload?.message || 'Eroare joc');
    });

    add('disconnect', () => {
      joinedRef.current = false;
    });

    add('reconnect', () => {
      joinGame();
    });

    return () => {
      unsubs.forEach((u) => u());
      leaveGame();
    };
  }, [gameId, on, joinGame, leaveGame]);

  // Compute FEN for the currently replayed position
  const replayFen = useMemo(() => {
    if (!state?.fen) return null;
    if (replayIndex === null || replayIndex >= movesLength - 1) return state.fen;
    // Build FEN from moves fenAfter or fall back to first move's fenBefore
    if (!movesLength) return state.fen;
    const move = moves[replayIndex];
    if (move?.fenAfter) return move.fenAfter;
    try {
      let chess = createChessInstance(moves[0]?.fenBefore || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      for (let i = 0; i <= replayIndex; i++) {
        const m = moves[i];
        if (!m) break;
        if (m.lan) {
          try { chess.move(m.lan, { strict: false }); continue; } catch {}
        }
        if (m.from && m.to) {
          try {
            chess.move({ from: m.from, to: m.to, promotion: m.promotion });
          } catch {}
        }
      }
      return chess.fen();
    } catch {
      return state.fen;
    }
  }, [state, replayIndex, movesLength, moves]);

  const lastMoveReplay = useMemo(() => {
    if (replayIndex === null) return null;
    const m = moves[replayIndex];
    if (!m) return null;
    return { from: m.from, to: m.to };
  }, [replayIndex, moves]);

  const liveLastMove = useMemo(() => {
    if (movesLength === 0) return null;
    const m = moves[movesLength - 1];
    return { from: m.from, to: m.to };
  }, [movesLength, moves]);

  const lastMove = replayIndex === null || replayIndex === movesLength - 1
    ? liveLastMove
    : lastMoveReplay;

  const isReplay = replayIndex !== null && replayIndex < movesLength - 1;

  // Memoized check info for currently displayed FEN (replay or live)
  const { isCheck, checkSquare } = useMemo(() => {
    const fen = replayFen;
    if (!fen) return { isCheck: false, checkSquare: null };
    try {
      const chess = createChessInstance(fen);
      if (!chess.isCheck()) return { isCheck: false, checkSquare: null };
      const turn = chess.turn();
      const board = chess.board();
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = board[r][f];
          if (p && p.type === 'k' && p.color === turn) {
            return { isCheck: true, checkSquare: files[f] + (8 - r) };
          }
        }
      }
      return { isCheck: true, checkSquare: null };
    } catch {
      return { isCheck: false, checkSquare: null };
    }
  }, [replayFen]);

  return {
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
    setReplayIndex: goToMove,
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
    userId: user?._id,
  };
}

export default useGame;
