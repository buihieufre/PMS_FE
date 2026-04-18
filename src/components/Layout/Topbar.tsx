import React, { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { 
  Bell, 
  Search, 
  Settings, 
  LogOut, 
  User as UserIcon, 
  ChevronDown,
  Zap,
  Check,
  CheckCircle2
} from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { SettingsModal } from '../Modal/SettingsModal';
import { useRouter } from 'next/router';

import { requestNotificationPermission } from '@/lib/firebase';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

export const Topbar = () => {
  const { user, logout } = useAuthStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();



  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

  const handleNotificationClick = (id: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead(id);
    }
  };

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative group max-w-md w-full sm:block hidden">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          </span>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 sm:text-sm transition-all"
            placeholder="Tìm kiếm công việc, dự án..."
          />
        </div>
      </div>



      <div className="flex items-center gap-4">
        {/* Notifications Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right divide-y divide-slate-100 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden border border-slate-100 flex flex-col max-h-[500px]">
              <div className="px-4 py-3 bg-slate-50/50 flex justify-between items-center shrink-0">
                <p className="text-sm font-bold text-slate-800">Thông báo</p>
                {unreadCount > 0 && (
                  <button 
                    onClick={() => markAllAsRead()}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition-all flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Đánh dấu tất cả đã đọc
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    Không có thông báo nào.
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <Menu.Item key={notification.id}>
                      {({ active }) => (
                        <div
                          onClick={() => handleNotificationClick(notification.id, notification.isRead)}
                          className={`
                            group flex w-full cursor-pointer flex-col p-4 transition-colors
                            ${active ? 'bg-slate-50' : 'bg-white'}
                            ${!notification.isRead ? 'bg-emerald-50/30' : ''}
                          `}
                        >
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <p className={`text-sm ${!notification.isRead ? 'font-bold text-emerald-900' : 'font-semibold text-slate-700'}`}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                            )}
                          </div>
                          <p className={`text-xs mb-2 ${!notification.isRead ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                            {notification.content || 'Bạn có một thông báo mới.'}
                          </p>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </Menu.Item>
                  ))
                )}
              </div>
            </Menu.Items>
          </Transition>
        </Menu>

        <div className="h-8 w-px bg-slate-200 mx-1" />

        {/* User Profile Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-800 leading-none mb-1 group-hover:text-emerald-600 transition-colors">
                {user?.displayName}
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded leading-none">
                {user?.role}
              </span>
            </div>
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 p-0.5 shadow-md group-hover:scale-105 transition-transform duration-300">
                <div className="h-full w-full rounded-[10px] bg-white overflow-hidden flex items-center justify-center">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="User" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors sm:block hidden" />
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-slate-100 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden border border-slate-100">
              <div className="px-4 py-4 bg-slate-50/50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Đã đăng nhập với</p>
                <p className="text-sm font-bold text-slate-800 truncate">{user?.email}</p>
              </div>
              <div className="px-1 py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className={`${
                        active ? 'bg-emerald-50 text-emerald-600' : 'text-slate-700'
                      } group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                    >
                      <Settings className="mr-3 h-4 w-4 transition-transform group-hover:rotate-45" />
                      Cài đặt tài khoản
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`${
                        active ? 'bg-emerald-50 text-emerald-600' : 'text-slate-700'
                      } group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                    >
                      <Zap className="mr-3 h-4 w-4 text-amber-500" />
                      Gói Pro
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={async () => {
                         try {
                           const token = await requestNotificationPermission();
                           if (token) {
                             await axiosInstance.post('/notifications/fcm-token', { token });
                             toast.success('Đã kết nối Thông báo Đẩy thành công! 🔔');
                             
                             // TEST PUSH NOTIFICATION IMMEDIATELY
                             if (Notification.permission === 'granted') {
                               new Notification('Test Thông Báo!', {
                                 body: 'Bong bóng Push Notification ở hệ điều hành của bạn hoạt động rồi nè!',
                                 icon: '/favicon.ico'
                               });
                             }
                           } else {
                             if (Notification.permission === 'denied') toast.error('Bạn đã chặn thông báo ở Ổ khoá 🔒.');
                             else toast.error('Không lấy được quyền thông báo.');
                           }
                         } catch (error) {
                           console.error(error);
                           toast.error('Lỗi khi xin quyền Thông báo.');
                         }
                      }}
                      className={`${
                        active ? 'bg-emerald-50 text-emerald-600' : 'text-slate-700'
                      } group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors`}
                    >
                      <Bell className="mr-3 h-4 w-4 text-emerald-500" />
                      Bật Thông báo Đẩy
                    </button>
                  )}
                </Menu.Item>
              </div>
              <div className="px-1 py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`${
                        active ? 'bg-rose-50 text-rose-600' : 'text-rose-500'
                      } group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-bold transition-colors`}
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Đăng xuất
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};
