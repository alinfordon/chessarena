'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const pendingListenersRef = useRef([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const tokenRef = useRef(null);
  const usernameRef = useRef(null);

  const attachPendingListeners = useCallback((socket) => {
    for (const { event, handler } of pendingListenersRef.current) {
      socket.on(event, handler);
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return socketRef.current;
    }
    if (socketRef.current) {
      try { socketRef.current.destroy(); } catch {}
      socketRef.current = null;
    }
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['polling', 'websocket'],
      upgrade: true,
      withCredentials: true,
      auth: tokenRef.current
        ? { token: tokenRef.current, username: usernameRef.current || undefined }
        : undefined,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected', socket.id, 'via', socket.io?.engine?.transport?.name);
      setConnected(true);
      setReconnecting(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      const msg = err?.message || String(err);
      if (msg === 'websocket error') {
        console.warn('[Socket] WebSocket unavailable, using polling');
      } else {
        console.error('[Socket] Connection error:', msg);
      }
      setConnected(socket.connected);
    });

    socket.on('reconnect', (attempt) => {
      console.log(`[Socket] Reconnected after ${attempt} attempts`);
      setReconnecting(false);
    });

    socket.on('reconnecting', (attempt) => {
      console.log(`[Socket] Reconnecting... attempt ${attempt}`);
      setReconnecting(true);
    });

    attachPendingListeners(socket);
    socketRef.current = socket;
    return socket;
  }, [attachPendingListeners]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  const emit = useCallback((event, data, callback) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data, callback);
    }
  }, []);

  const on = useCallback((event, handler) => {
    pendingListenersRef.current.push({ event, handler });
    socketRef.current?.on(event, handler);
    return () => {
      pendingListenersRef.current = pendingListenersRef.current.filter(
        (l) => !(l.event === event && l.handler === handler)
      );
      socketRef.current?.off(event, handler);
    };
  }, []);

  const off = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' }).catch(() => null);
        if (cancelled) return;
        const data = res?.ok ? await res.json().catch(() => ({})) : {};
        tokenRef.current = data?.socketToken || null;
        usernameRef.current = data?.user?.username || null;
        console.log('[Socket] Init:', { hasToken: !!tokenRef.current, username: usernameRef.current });
      } catch (e) {
        console.warn('[Socket] Failed to fetch socket auth token:', e?.message || e);
        tokenRef.current = null;
      }
      connect();
    })();
    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [connect]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        reconnecting,
        connect,
        disconnect,
        emit,
        on,
        off,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return ctx;
}

export default SocketProvider;
