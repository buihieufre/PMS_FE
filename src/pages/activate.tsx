import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Loader2, CheckCircle2, XCircle, MailWarning } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

export default function ActivatePage() {
  const router = useRouter();
  const { token, email } = router.query;

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // Wait until router is ready
    if (!router.isReady) return;

    if (!token || !email) {
      setStatus('error');
      setErrorMessage('Invalid activation link. Missing token or email parameter.');
      return;
    }

    const verifyToken = async () => {
      try {
        await axiosInstance.post('/auth/verify-activation', { 
          email: email as string, 
          token: token as string 
        });
        // Token is valid! Backend generated a temporary password and sent it.
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.response?.data?.error || 'Verification failed');
      }
    };

    verifyToken();
  }, [router.isReady, token, email]);

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post('/auth/setup-password', {
        email: email as string,
        newPassword
      });
      toast.success('Password configured successfully!');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to setup password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await axiosInstance.post('/auth/resend-activation', { email: email as string });
      toast.success('A new activation link has been sent to your email.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to resend activation link');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Activate Account | PMS</title>
      </Head>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Account Activation
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-10 w-10 text-slate-400 animate-spin mb-4" />
              <p className="text-slate-500 text-sm">Verifying your secure link...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center py-6 text-center">
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Activation Failed</h3>
              <p className="text-sm text-slate-500 mb-6">{errorMessage}</p>
              
              <button
                onClick={handleResend}
                disabled={isResending || !email}
                className="w-full flex justify-center py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
              >
                {isResending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MailWarning className="h-4 w-4 mr-2 text-slate-500" />}
                Resend Activation Link
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center text-center mb-6 border-b border-slate-100 pb-6">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">Account Verified!</h3>
                <p className="text-sm text-slate-500 px-4">
                  We've emailed you a temporary password just in case. However, you should securely configure your permanent password below right now.
                </p>
              </div>

              <form onSubmit={handleSetupPassword} className="space-y-6">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
                    Set New Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-slate-900 focus:border-slate-900 sm:text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Must be at least 6 characters long.</p>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-70 transition-colors"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Login'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
