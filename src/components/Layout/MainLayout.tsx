import Sidebar from '@/components/Layout/Sidebar';
import { Topbar } from '@/components/Layout/Topbar';
import { ReactNode, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { toast } from 'sonner';
import { Bell, Clock } from 'lucide-react';
import { useRouter } from 'next/router';
import { requestNotificationPermission, initMessaging, onMessage } from '@/lib/firebase';
import axiosInstance from '@/lib/axios';

interface MainLayoutProps {
  children: ReactNode;
  hideSidebar?: boolean;
  hideTopbar?: boolean;
  noPadding?: boolean;
  noScroll?: boolean;
  fullWidth?: boolean;
}

export default function MainLayout({
  children,
  hideSidebar = false,
  hideTopbar = false,
  noPadding = false,
  noScroll = false,
  fullWidth = false
}: MainLayoutProps) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const { projectId } = router.query;
  
  const { on, off } = useSocket(projectId as string, user?.id);
  const fetchNotifications = useNotificationStore(state => state.fetchNotifications);
  const addNotification = useNotificationStore(state => state.addNotification);

  // Fetch notifications on mount
  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Setup Firebase Push Notifications
      const setupFCM = async () => {
        try {
          if (Notification.permission === 'granted') {
             // Already granted, silently get token
             const token = await requestNotificationPermission();
             if (token) await axiosInstance.post('/notifications/fcm-token', { token });
          } else if (Notification.permission === 'denied') {
             toast.error('Bạn đã chặn thông báo. Hãy bấm vào biểu tượng Ổ khoá 🔒 trên thanh địa chỉ để bật lại nhé!', { duration: 5000 });
          } else {
             // Not decided yet, request it
             toast('Hệ thống đang xin quyền thông báo...', { id: 'fcm-req' });
             const token = await requestNotificationPermission();
             toast.dismiss('fcm-req');
             if (token) {
               await axiosInstance.post('/notifications/fcm-token', { token });
               toast.success('Đã kết nối Thông báo Đẩy thành công! 🔔');
             }
          }

          // Bắt sóng Notification kể cả khi đang xem màn hình (Foreground)
          const msg = await initMessaging();
          if (msg) {
            onMessage(msg, (payload) => {
              console.log("[FCM] Nhận được thông báo Firebase Foreground:", payload);
              if (Notification.permission === 'granted' && payload?.notification) {
                new Notification(payload.notification.title || 'Thông báo', {
                  body: payload.notification.body,
                  icon: '/favicon.ico'
                });
              }
            });
          }
        } catch (error) {
          console.error("Failed to setup FCM:", error);
        }
      };
      setupFCM();
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!user) return;

    const handleNewNotification = (notification: any) => {
      // Add to store
      addNotification(notification);

      // Show toast
      toast.custom((id) => (
        <div className="max-w-[400px] w-full bg-white shadow-2xl rounded-xl border-l-4 border-emerald-500 p-4 flex items-center space-x-4 pointer-events-auto">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Bell className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900 uppercase tracking-tight leading-none mb-1">
              {notification.title}
            </p>
            <p className="text-sm text-slate-600 font-medium">
              {notification.content}
            </p>
            <p className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
               Lúc: {new Date(notification.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => toast.dismiss(id)}
            className="ml-4 flex-shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
      ), {
        duration: 8000,
        id: `notification-${notification.id}`,
      });
    };

    on('notification:new', handleNewNotification);
    return () => {
      off('notification:new', handleNewNotification);
    };
  }, [user, on, off, addNotification]);

  return (
    <div className="flex h-screen w-full min-w-0 overflow-hidden bg-slate-50">
      {!hideSidebar && <Sidebar />}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        {!hideTopbar && <Topbar showSidebarToggle={!hideSidebar} />}
        <main
          className={`min-h-0 flex-1 ${noScroll ? 'flex flex-col overflow-hidden' : 'overflow-auto'} ${noPadding ? 'p-0' : 'p-8 pb-20'}`}
        >
          <div
            className={`flex min-h-0 w-full flex-col ${
              noScroll ? 'h-full' : 'min-h-full'
            } ${fullWidth ? '' : 'max-w-[1600px] 2xl:max-w-[1800px] mx-auto'}`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
