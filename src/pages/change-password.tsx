import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MainLayout from '@/components/Layout/MainLayout';
import { PageHeader } from '@/components/Layout/PageHeader';
import { Loader2, KeyRound, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

type Step = 1 | 2 | 3; // 1: Old Password, 2: New Password, 3: Success

export default function ChangePasswordPage() {
  const [step, setStep] = useState<Step>(1);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCheckOldPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      toast.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }

    setIsLoading(true);
    try {
      await axiosInstance.post('/auth/check-password', { password: oldPassword });
      setStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Mật khẩu hiện tại không chính xác');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Vui lòng điền đầy đủ thông tin mật khẩu mới');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setIsLoading(true);
    try {
      await axiosInstance.post('/auth/change-password', {
        oldPassword,
        newPassword,
      });
      setStep(3);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Không thể đổi mật khẩu');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <form onSubmit={handleCheckOldPassword} className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu hiện tại</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm text-lg tracking-widest font-medium"
                placeholder="••••••••"
              />
              <p className="mt-3 text-sm text-slate-500">Vui lòng nhập mật khẩu hiện tại của bạn để tiếp tục đổi mật khẩu.</p>
            </div>
            
            <div className="flex pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 focus:ring-4 focus:ring-slate-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Tiếp tục <ShieldCheck className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </form>
        );

      case 2:
        return (
          <form onSubmit={handleChangePassword} className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm text-base"
                  placeholder="Mật khẩu mới"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm text-base"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center transition-colors px-4 py-2 hover:bg-slate-50 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Đổi mật khẩu'
                )}
              </button>
            </div>
          </form>
        );

      case 3:
        return (
          <div className="flex flex-col max-w-md py-6 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Hoàn tất!</h2>
            <p className="text-slate-500 mb-8">Mật khẩu của bạn đã được thay đổi thành công. Từ giờ bạn hãy đăng nhập bằng mật khẩu mới này nhé.</p>
            <button 
              onClick={() => router.push('/settings')}
              className="w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition-all"
            >
              Quay lại Cài đặt
            </button>
          </div>
        );
    }
  };

  return (
    <MainLayout>
      <Head>
        <title>Đổi mật khẩu | PMS</title>
      </Head>

      <div className="max-w-7xl mx-auto">
        <PageHeader
          title={<>Đổi mật khẩu</>}
          description="Bảo mật tài khoản của bạn bằng mật khẩu mạnh."
        />

        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-8 md:p-10 shadow-sm min-h-[400px]">
          {renderStep()}
        </div>
      </div>
    </MainLayout>
  );
}
