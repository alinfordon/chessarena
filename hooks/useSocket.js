'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const tokenRef = useRef(null);
  const usernameRef = useRef(null);

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
      timeout: 10000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: tokenRef.current
        ? { token: tokenRef.current, username: usernameRef.current || undefined }
        : undefined,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setConnected(true);
      setReconnecting(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setConnected(false);
    });

    socket.on('reconnect', (attempt) => {
      console.log(`[Socket] Reconnected after ${attempt} attempts`);
      setReconnecting(false);
    });

    socket.on('reconnecting', (attempt) => {
      console.log(`[Socket] Reconnecting... attempt ${attempt}`);
      setReconnecting(true);
    });

    socketRef.current = socket;
    return socket;
  }, []);

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
    if (socketRef.current) {
      socketRef.current.on(event, handler);
      return () => socketRef.current?.off(event, handler);
    }
    return () => {};
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
