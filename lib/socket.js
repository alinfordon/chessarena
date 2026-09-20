const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const SOCKET_EVENTS = {
  GAME: {
    JOIN: 'game:join',
    LEAVE: 'game:leave',
    MOVE: 'game:move',
    STATE: 'game:state',
    CLOCK: 'game:clock',
    RESIGN: 'game:resign',
    OFFER_DRAW: 'game:offer-draw',
    ACCEPT_DRAW: 'game:accept-draw',
    DECLINE_DRAW: 'game:decline-draw',
    DRAW_OFFERED: 'game:draw-offered',
    DRAW_DECLINED: 'game:draw-declined',
    REMATCH: 'game:rematch',
    REMATCH_OFFERED: 'game:rematch-offered',
    DISCONNECT: 'game:disconnect',
    RECONNECT: 'game:reconnect',
    FINISHED: 'game:finished',
  },
  CHAT: {
    MESSAGE: 'chat:message',
  },
  USER: {
    ONLINE: 'user:online',
    OFFLINE: 'user:offline',
  },
  VIDEO: {
    OFFER: 'video:offer',
    ANSWER: 'video:answer',
    ICE_CANDIDATE: 'video:ice-candidate',
  },
  TOURNAMENT: {
    JOIN: 'tournament:join',
    LEAVE: 'tournament:leave',
    PAIRING: 'tournament:pairing',
    START: 'tournament:start',
    UPDATE: 'tournament:update',
  },
};

export function getSocketUrl() {
  return SOCKET_URL;
}

export default { SOCKET_EVENTS, getSocketUrl };
