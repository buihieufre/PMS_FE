import { io, type Socket } from 'socket.io-client';

const URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

/**
 * Một kết nối Socket.IO cho toàn app (SPA). Không disconnect khi đổi trang
 * hoặc chuyển tab — tránh tạo/đóng hàng loạt socket từ nhiều component.
 */
export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    // SSR: không dùng socket; tránh lỗi nếu gọi nhầm
    return null as unknown as Socket;
  }
  if (!socket) {
    socket = io(URL, {
      // Ưu tiên WebSocket, khi tường lửa/background tab rớt thì vẫn polling được
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 20000,
      randomizationFactor: 0.5,
      timeout: 25000,
      autoConnect: true,
    });
  }
  return socket;
}

export function isSocketReady(): boolean {
  return typeof window !== 'undefined' && !!socket?.connected;
}

/** Gọi khi đăng xuất: đóng hẳn để hết bám room / session kế tiếp */
export function resetSocket(): void {
  if (typeof window === 'undefined' || !socket) return;
  try {
    socket.disconnect();
  } finally {
    socket = null;
  }
}
