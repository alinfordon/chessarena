'use client';

import { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import { getLegalMoves } from '@/utils/chess';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const PIECE_UNICODE = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export default function ChessBoard({
  fen,
  orientation = 'white',
  onMove,
  lastMove = null,
  disabled = false,
  isCheck = false,
  checkSquare = null,
  className = '',
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [promotion, setPromotion] = useState(null);

  const pieces = useMemo(() => {
    if (!fen) return {};
    const board = {};
    const [position] = fen.split(' ');
    const rows = position.split('/');
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) {
          f += parseInt(ch, 10);
        } else {
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          const piece = ch.toUpperCase();
          const square = FILES[f] + RANKS[r];
          board[square] = color + piece;
          f++;
        }
      }
    }
    return board;
  }, [fen]);

  const legalMoves = useMemo(() => {
    if (!fen || !selectedSquare) return [];
    return getLegalMoves(fen, selectedSquare);
  }, [fen, selectedSquare]);

  const legalTargets = useMemo(() => {
    return new Set(legalMoves.map((m) => m.to));
  }, [legalMoves]);

  const isLastMove = (sq) =>
    lastMove && (lastMove.from === sq || lastMove.to === sq);

  const isSelected = (sq) => selectedSquare === sq;

  const isCheckSq = (sq) => isCheck && checkSquare === sq;

  const handleSquareClick = (square) => {
    if (disabled) return;
    const piece = pieces[square];

    if (selectedSquare && legalTargets.has(square)) {
      const mover = pieces[selectedSquare];
      const isPawn = mover && mover[1] === 'P';
      const targetRank = square[1];
      if (isPawn && (targetRank === '1' || targetRank === '8')) {
        setPromotion({ from: selectedSquare, to: square });
        return;
      }
      onMove?.(selectedSquare, square);
      setSelectedSquare(null);
      return;
    }

    if (piece) {
      const turn = fen?.split(' ')[1];
      const myColor = orientation === 'white' ? 'w' : 'b';
      const pieceColor = piece[0];
      if (turn && pieceColor !== turn) {
        setSelectedSquare(null);
        return;
      }
      if (pieceColor === myColor || !turn) {
        setSelectedSquare(square);
        return;
      }
    }
    setSelectedSquare(null);
  };

  const handlePromotion = (pieceType) => {
    if (!promotion) return;
    const promo = String(pieceType || 'q').toLowerCase().slice(0, 1);
    onMove?.(promotion.from, promotion.to, ['q', 'r', 'b', 'n'].includes(promo) ? promo : 'q');
    setPromotion(null);
    setSelectedSquare(null);
  };

  const squares = [];
  const displayRanks = orientation === 'black' ? [...RANKS].reverse() : RANKS;
  const displayFiles = orientation === 'black' ? [...FILES].reverse() : FILES;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const file = displayFiles[f];
      const rank = displayRanks[r];
      const square = file + rank;
      const isLight = (r + f) % 2 === 0;
      const piece = pieces[square];
      const isLegalTarget = legalTargets.has(square);
      const isCapture = isLegalTarget && !!piece;

      squares.push(
        <div
          key={square}
          onClick={() => handleSquareClick(square)}
          className={clsx(
            'relative w-full aspect-square flex items-center justify-center select-none cursor-grab active:cursor-grabbing transition-colors',
            isLight ? 'bg-chess-light' : 'bg-chess-dark',
            isSelected(square) && 'ring-4 ring-inset ring-yellow-400/80',
            isLastMove(square) && !isSelected(square) && 'bg-yellow-200/70 dark:bg-yellow-700/50',
            isCheckSq(square) && 'ring-4 ring-inset ring-red-500 animate-pulse',
            disabled && 'cursor-not-allowed opacity-90'
          )}
        >
          {(f === 0) && (
            <span className={clsx(
              'absolute top-0.5 left-0.5 text-[10px] sm:text-xs font-bold pointer-events-none',
              isLight ? 'text-chess-dark' : 'text-chess-light'
            )}>
              {rank}
            </span>
          )}
          {(r === 7) && (
            <span className={clsx(
              'absolute bottom-0.5 right-0.5 text-[10px] sm:text-xs font-bold pointer-events-none',
              isLight ? 'text-chess-dark' : 'text-chess-light'
            )}>
              {file}
            </span>
          )}
          {piece && (
            <span className={clsx(
              'text-[clamp(1.35rem,10cqi,3.4rem)] leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]',
              piece[0] === 'w' ? 'text-white' : 'text-slate-900',
              isCheckSq(square) && 'animate-pulse'
            )}>
              {PIECE_UNICODE[piece]}
            </span>
          )}
          {isLegalTarget && !isCapture && (
            <span className="absolute w-1/4 h-1/4 rounded-full bg-slate-900/30 dark:bg-white/30 pointer-events-none" />
          )}
          {isLegalTarget && isCapture && (
            <span className="absolute inset-1 rounded-full ring-4 ring-slate-900/40 dark:ring-white/40 pointer-events-none" />
          )}
        </div>
      );
    }
  }

  return (
    <div className={clsx('w-full max-w-[min(92vw,92vh,720px)] mx-auto', className)}>
      <div className="grid grid-cols-8 gap-0 rounded-lg overflow-hidden shadow-premium border border-slate-300/60 dark:border-slate-700/60 [container-type:inline-size]">
        {squares}
      </div>
      <Modal
        isOpen={!!promotion}
        onClose={() => setPromotion(null)}
        title="Promovare Pion"
        description="Alegeți piesa în care promovați pionul:"
        size="sm"
      >
        <div className="grid grid-cols-4 gap-3">
          {['q', 'r', 'b', 'n'].map((p) => {
            const key = (orientation === 'white' ? 'w' : 'b') + p.toUpperCase();
            return (
              <Button
                key={p}
                variant="secondary"
                size="lg"
                type="button"
                onClick={() => handlePromotion(p)}
                className="!p-2 aspect-square text-4xl sm:text-5xl"
              >
                <span className={clsx(
                  orientation === 'white' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]' : 'text-slate-900'
                )}>
                  {PIECE_UNICODE[key]}
                </span>
              </Button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
