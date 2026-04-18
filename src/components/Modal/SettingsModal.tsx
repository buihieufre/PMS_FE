import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, User, Camera, Check, Sparkles, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.displayName || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user, isOpen]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Vui lòng nhập tên hiển thị');
      return;
    }

    setIsUpdating(true);
    try {
      console.log('[Settings] Updating profile...', { displayName, avatarUrl });
      const response = await axiosInstance.patch('/users/profile', {
        displayName: displayName.trim(),
        avatarUrl,
      });
      
      console.log('[Settings] Update response:', response.data);
      
      if (response.data.user) {
        // Update local store
        setUser({
          ...user!,
          displayName: response.data.user.displayName,
          avatarUrl: response.data.user.avatarUrl,
        });
        toast.success('Cập nhật hồ sơ thành công!');
        onClose();
      } else {
        throw new Error('Không nhận được dữ liệu người dùng sau khi cập nhật');
      }
    } catch (error: any) {
      console.error('[Settings] Update failed:', error);
      toast.error(error.response?.data?.error || error.message || 'Có lỗi xảy ra khi cập nhật hồ sơ');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-2xl transition-all border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="h3" className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    Cài đặt tài khoản
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  {/* Avatar Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Ảnh đại diện
                    </label>
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-full ring-4 ring-indigo-50 overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-12 h-12 text-slate-300" />
                          )}
                        </div>
                        <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3 w-full">
                        {PRESET_AVATARS.map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setAvatarUrl(url)}
                            className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all hover:scale-105 ${
                              avatarUrl === url ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'
                            }`}
                          >
                            <img src={url} alt="Preset Avatar" className="w-full h-full object-cover" />
                            {avatarUrl === url && (
                              <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                                <div className="bg-white rounded-full p-0.5 shadow-sm">
                                  <Check className="w-3 h-3 text-indigo-600 font-bold" />
                                </div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      
                      <div className="w-full">
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Hoặc nhập URL ảnh tùy chỉnh
                        </label>
                        <input
                          type="text"
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50"
                          placeholder="https://example.com/avatar.png"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Tên hiển thị
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                      placeholder="Họ và tên của bạn"
                    />
                  </div>

                  {/* Role Info (Read Only) */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Vai trò hiện tại</p>
                      <p className="text-sm font-bold text-slate-700">{user?.role}</p>
                    </div>
                    <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-600 max-w-[150px] truncate">
                      {user?.email}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Lưu thay đổi'
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
