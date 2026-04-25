import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Loader2, Mail, Lock, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Removed local error state; using toast for notifications
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    if (accessToken) {
      router.replace('/');
    }
  }, [accessToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Manual validation to allow toasts for empty fields
    if (!email.trim()) {
      return toast.error('Vui lòng nhập địa chỉ email');
    }
    if (!password.trim()) {
      return toast.error('Vui lòng nhập mật khẩu');
    }

    setIsLoading(true);

    try {
      const response = await axiosInstance.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;
      setAuth(accessToken, null, user);
      toast.success('Đăng nhập thành công!');
      router.push('/');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error;
      
      // Handle specific error cases if backend returns codes
      if (errorMsg === 'USER_NOT_FOUND') {
        toast.error('Tài khoản không tồn tại trong hệ thống');
      } else if (errorMsg === 'USER_LOCKED') {
        toast.error('Tài khoản của bạn đã bị khóa');
      } else if (errorMsg === 'INVALID_CREDENTIALS') {
        toast.error('Email hoặc mật khẩu không chính xác');
      } else {
        toast.error(errorMsg || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-hidden relative">
      <Head>
        <title>Đăng nhập | PMS</title>
      </Head>
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/20 blur-[120px]" />

      <div className="w-full max-w-md p-8 bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.5)] relative z-10 animate-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-sky-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6 rotate-3">
            <LayoutDashboard className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">Chào mừng trở lại</h2>
          <p className="text-slate-400 font-medium">Đăng nhập vào không gian làm việc của bạn</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
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

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="password" 
                placeholder="••••••••"
                className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center text-sm font-medium text-slate-400 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 mr-2 transition-all" />
              <span className="group-hover:text-slate-200 transition-colors">Ghi nhớ đăng nhập</span>
            </label>
            <a href="#" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Quên mật khẩu?</a>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              'Đăng nhập ngay'
            )}
          </button>
        </form>
        
        <p className="mt-8 text-center text-sm text-slate-500 font-medium">
          Hệ thống quản lý PMS bảo mật
        </p>
      </div>
      
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
