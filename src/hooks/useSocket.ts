import { useEffect, useCallback, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, resetSocket } from '@/lib/socketManager';

// Re-export for components that need one-off .on/.off in a single useEffect
export { getSocket, resetSocket };

type Callback = (data: any) => void;

/**
 * Một kết nối socket dùng chung; join project / user khi tham số thay đổi.
 * Không gọi disconnect() khi component unmount (trừ toàn bộ trang tắt).
 */
export const useSocket = (projectId?: string, userId?: string) => {
  const [, setTick] = useState(0);
  // Force re-render khi nối lại (để UI có thể bám socket.id)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = getSocket();
    const bump = () => setTick((t) => t + 1);
    s.on('connect', bump);
    s.on('disconnect', bump);
    return () => {
      s.off('connect', bump);
      s.off('disconnect', bump);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = getSocket();

    const join = () => {
      if (projectId) {
        s.emit('join_project', projectId);
      }
      if (userId) {
        s.emit('join_user', userId);
      }
    };

    s.on('connect', join);
    if (s.connected) {
      join();
    }

    // Khi bật lại tab / app, thử bám lại nếu server / CDP cắt trước đó
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !s.connected) {
        s.connect();
        join();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Trình duyệt một số tình huống "đóng nguồn" tạm thời
    window.addEventListener('focus', onVisibility);

    return () => {
      s.off('connect', join);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [projectId, userId]);

  const on = useCallback((event: string, callback: Callback) => {
    getSocket().on(event, callback);
  }, []);

  const off = useCallback((event: string, callback?: Callback) => {
    const s = getSocket();
    if (callback) s.off(event, callback);
    else s.off(event);
  }, []);

  const emit = useCallback((event: string, data: any, callback?: (response: any) => void) => {
    const s = getSocket();
    if (callback) s.emit(event, data, callback);
    else s.emit(event, data);
  }, []);

  return { on, off, emit, socket: getSocket() as Socket };
};
