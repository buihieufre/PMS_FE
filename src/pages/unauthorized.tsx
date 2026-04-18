import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <MainLayout hideSidebar>
      <Head>
        <title>Không có quyền truy cập | PMS</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="bg-red-50 p-6 rounded-full mb-6">
          <ShieldAlert className="h-16 w-16 text-red-500" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Access Denied</h1>
        <p className="text-slate-500 text-lg max-w-md mb-8">
          Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên nếu bạn cho rằng đây là một sự nhầm lẫn.
        </p>
        <div className="flex space-x-4">
          <button 
            onClick={() => router.back()}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center shadow-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </button>
          <Link 
            href="/"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            Về Trang Chủ
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
