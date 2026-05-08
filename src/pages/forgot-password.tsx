import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axiosInstance from '@/lib/axios';
import { Loader2, Mail, Lock, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AppLogo } from '@/components/Brand/AppLogo';
import { toast } from 'sonner';

type Step = 1 | 2 | 3 | 4; // 4 is success state

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!email.trim()) {
      return toast.error('Vui lòng nhập địa chỉ email');
    }

    setIsLoading(true);
    try {
      const res = await axiosInstance.post('/auth/forgot-password', { email });
      toast.success(res.data.message || 'Mã OTP đã được gửi đến email của bạn');
      setStep(2);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Không thể gửi mã. Vui lòng thử lại.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!otpCode.trim() || otpCode.length < 6) {
      return toast.error('Vui lòng nhập mã OTP hợp lệ');
    }

    setIsLoading(true);
    try {
      const res = await axiosInstance.post('/auth/verify-reset-otp', { email, otpCode });
      setResetToken(res.data.resetToken);
      toast.success('Xác thực thành công. Vui lòng tạo mật khẩu mới.');
      setStep(3);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Mã OTP không hợp lệ hoặc đã hết hạn.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!newPassword.trim()) {
      return toast.error('Vui lòng nhập mật khẩu mới');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Mật khẩu xác nhận không khớp');
    }

    setIsLoading(true);
    try {
      await axiosInstance.post('/auth/reset-password', { resetToken, newPassword });
      setStep(4);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <div className="flex flex-col items-center mb-10 text-center">
              <div className="mb-6 rotate-3 drop-shadow-2xl">
                <AppLogo boardBackground={null} size={64} />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Quên mật khẩu?</h2>
              <p className="text-slate-400 font-medium px-4">Đừng lo, hãy nhập email của bạn và chúng tôi sẽ gửi mã khôi phục.</p>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email của bạn</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="email" 
                    placeholder="ten-dang-nhap@congty.com"
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Gửi mã khôi phục'}
              </button>
            </form>
          </>
        );

      case 2:
        return (
          <>
            <div className="flex flex-col items-center mb-10 text-center animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6">
                <KeyRound className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Nhập mã xác nhận</h2>
              <p className="text-slate-400 font-medium">Mã 6 chữ số đã được gửi tới <span className="text-white">{email}</span></p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mã OTP</label>
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 px-6 text-center text-2xl tracking-[0.5em] text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-black"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center group relative overflow-hidden"
              >
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Xác nhận mã'}
              </button>
            </form>
          </>
        );

      case 3:
        return (
          <>
            <div className="flex flex-col items-center mb-10 text-center animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <Lock className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Tạo mật khẩu mới</h2>
              <p className="text-slate-400 font-medium">Mật khẩu của bạn phải có ít nhất 6 ký tự.</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu mới</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Xác nhận mật khẩu</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center mt-6"
              >
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Đổi mật khẩu'}
              </button>
            </form>
          </>
        );

      case 4:
        return (
          <div className="flex flex-col items-center text-center animate-in zoom-in-95 duration-500 py-6">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-4">Hoàn tất!</h2>
            <p className="text-slate-400 font-medium mb-8">Mật khẩu của bạn đã được thay đổi thành công. Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.</p>
            <Link 
              href="/login"
              className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98] hover:bg-slate-100 flex items-center justify-center"
            >
              Về trang đăng nhập
            </Link>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-hidden relative">
      <Head>
        <title>Quên mật khẩu | PMS</title>
      </Head>
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/20 blur-[120px]" />

      <div className="w-full max-w-md p-8 bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.5)] relative z-10">
        {step < 4 && (
          <div className="absolute top-8 left-8">
            <button 
              onClick={() => step > 1 ? setStep((prev) => (prev - 1) as Step) : router.push('/login')}
              className="text-slate-400 hover:text-white transition-colors flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="mt-4">
          {renderStep()}
        </div>

        {step === 1 && (
          <div className="mt-8 text-center">
            <Link href="/login" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
              Quay lại đăng nhập
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
