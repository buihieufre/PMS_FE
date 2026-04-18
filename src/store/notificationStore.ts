import { create } from 'zustand';
import axiosInstance from '@/lib/axios';

export interface Notification {
  id: string;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  referenceId: string | null;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetchNotifications: async () => {
    try {
      const response = await axiosInstance.get('/notifications');
      const notifications = response.data.notifications;
      const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;
      set({ notifications, unreadCount });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  },

  markAsRead: async (id: string) => {
    try {
      await axiosInstance.patch(`/notifications/${id}/read`);
      const updatedNotifications = get().notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      );
      const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
      set({ notifications: updatedNotifications, unreadCount });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await axiosInstance.patch('/notifications/read-all');
      const updatedNotifications = get().notifications.map(n => ({ ...n, isRead: true }));
      set({ notifications: updatedNotifications, unreadCount: 0 });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => {
      // Prevent duplicates if socket fires multiple times
      if (state.notifications.some(n => n.id === notification.id)) {
        return state;
      }
      const newNotifications = [notification, ...state.notifications];
      return { 
        notifications: newNotifications,
        unreadCount: state.unreadCount + 1
      };
    });
  }
}));
