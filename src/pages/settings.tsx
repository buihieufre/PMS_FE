import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import { PageHeader } from '@/components/Layout/PageHeader';
import { User, Camera, Check, Sparkles, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

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

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || '');
    setAvatarUrl(user.avatarUrl || '');
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Vui lòng nhập tên hiển thị');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await axiosInstance.patch('/users/profile', {
        displayName: displayName.trim(),
        avatarUrl,
      });

      if (response.data.user) {
        setUser({
          ...user!,
          displayName: response.data.user.displayName,
          avatarUrl: response.data.user.avatarUrl,
        });
        toast.success('Cập nhật hồ sơ thành công!');
      } else {
        throw new Error('Không nhận được dữ liệu người dùng sau khi cập nhật');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Có lỗi xảy ra khi cập nhật hồ sơ');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh hợp lệ');
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Ảnh tối đa 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await axiosInstance.post('/users/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const nextAvatar = response.data?.avatarUrl || response.data?.user?.avatarUrl;
      if (!nextAvatar) {
        throw new Error('Không nhận được URL avatar sau khi upload');
      }
      setAvatarUrl(nextAvatar);
      if (response.data?.user) {
        setUser({
          ...user!,
          displayName: response.data.user.displayName ?? user?.displayName,
          avatarUrl: response.data.user.avatarUrl ?? nextAvatar,
        });
      } else {
        setUser({
          ...user!,
          avatarUrl: nextAvatar,
        });
      }
      toast.success('Tải ảnh đại diện thành công');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Không tải được ảnh đại diện');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <MainLayout>
      <Head>
        <title>Cài đặt | PMS</title>
      </Head>

      <div className="max-w-7xl mx-auto">
        <PageHeader
          title={<>Cài đặt tài khoản</>}
          description="Cập nhật thông tin hồ sơ và ảnh đại diện của bạn."
        />

        <div className="rounded-2xl border border-slate-100 bg-white p-8 md:p-10 shadow-sm">
          <form onSubmit={handleUpdateProfile} className="space-y-8 max-w-4xl">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Ảnh đại diện</label>
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

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUploadAvatar(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isUploadingAvatar ? 'Đang tải ảnh...' : 'Tải ảnh từ máy'}
                  </button>
                  <p className="text-xs text-slate-400">JPG, PNG, WEBP (tối đa 5MB)</p>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 w-full max-w-2xl">
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Hoặc nhập URL ảnh tùy chỉnh</label>
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

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Tên hiển thị</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full max-w-2xl px-5 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-base"
                placeholder="Họ và tên của bạn"
              />
            </div>

            <div className="max-w-2xl p-5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Vai trò hiện tại</p>
                <p className="text-sm font-bold text-slate-700">{user?.role}</p>
              </div>
              <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-600 max-w-[180px] truncate">
                {user?.email}
              </div>
            </div>

            <div className="flex justify-start pt-6 border-t border-slate-100 max-w-2xl">
              <button
                type="submit"
                disabled={isUpdating || isUploadingAvatar}
                className="px-8 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
