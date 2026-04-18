import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const useSocket = (projectId?: string, userId?: string) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to server. Room matching starting...');
      if (projectId) {
        socket.emit('join_project', projectId);
      }
      if (userId) {
        socket.emit('join_user', userId);
      }
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from server');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, userId]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    const attachListener = () => {
       if (socketRef.current) {
         socketRef.current.off(event); // Always unbind old listeners first
         socketRef.current.on(event, callback);
         console.log(`[SOCKET] Bound listener: ${event}`);
       } else {
         // Retry after a short delay if socket isn't ready
         setTimeout(attachListener, 100);
       }
    };
    attachListener();
  }, []);

  const off = useCallback((event: string) => {
    if (socketRef.current) {
      socketRef.current.off(event);
    }
  }, []);

  const emit = useCallback((event: string, data: any, callback?: (response: any) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.emit(event, data, callback);
      } else {
        socketRef.current.emit(event, data);
      }
    }
  }, []);

  return { on, off, emit, socket: socketRef.current };
};
