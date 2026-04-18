import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { ArrowLeft, Building2, Users, CheckSquare, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

export default function DepartmentDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const { user } = useAuthStore() as { user: any };
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [department, setDepartment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return; // wait for hydration
    if (user?.role !== 'ADMIN') {
      toast.error("Bạn không có quyền truy cập trang này");
      router.push('/unauthorized');
    } else {
      setIsAuthorized(true);
    }
  }, [user, router]);

  const fetchDepartment = async () => {
    if (!id) return;
    try {
      const res = await axiosInstance.get(`/departments/${id}`);
      setDepartment(res.data);
    } catch (err) {
      toast.error('Failed to fetch department details');
      router.push('/departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) fetchDepartment();
  }, [id, isAuthorized]);

  if (!router.isReady || loading) {
    return <MainLayout><div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></MainLayout>;
  }

  if (!isAuthorized || !department) return null;

  return (
    <MainLayout>
      <Head>
        <title>{department?.name || 'Department'} | PMS</title>
      </Head>
      <div className="mb-6 flex items-center space-x-4">
        <Link href="/departments" className="p-2 bg-white rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors shadow-sm">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center tracking-tight">
            <Building2 className="h-8 w-8 text-blue-600 mr-3" />
            {department.name}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Global Company Department</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Panel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 col-span-1 lg:col-span-3">
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
            <Settings className="h-5 w-5 mr-2 text-slate-500" /> Department Function
          </h2>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 whitespace-pre-wrap text-slate-700">
            {department.description || <span className="text-slate-400 italic">No function description provided.</span>}
          </div>
        </div>

        {/* Members List */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden h-96 col-span-1 lg:col-span-2">
          <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-bold flex items-center text-slate-800">
              <Users className="mr-2 h-5 w-5 text-indigo-600" />
              Department Roster
            </h2>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {department.users?.length || 0} Members
            </span>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
            {department.users?.length > 0 ? (
              <ul className="space-y-3">
                {department.users.map((user: any) => (
                  <li key={user.id} className="flex flex-col p-3 border border-slate-100 rounded-lg bg-white shadow-sm hover:border-indigo-300 transition-colors">
                     <span className="font-semibold text-slate-800">{user.displayName}</span>
                     <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>{user.email}</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{user.role?.name || 'USER'}</span>
                     </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 p-6 text-center">
                <Users className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No members assigned.</p>
                <p className="text-xs text-slate-400 mt-1">Go to Users page to assign employees to this department.</p>
              </div>
            )}
          </div>
        </div>

        {/* Global Tasks */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden h-96 col-span-1">
          <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-bold flex items-center text-slate-800">
              <CheckSquare className="mr-2 h-5 w-5 text-green-600" />
              Global Tasks
            </h2>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
             {department.tasks?.length > 0 ? (
              <ul className="space-y-3">
                {department.tasks.map((task: any) => (
                  <li key={task.id} className="p-3 border border-slate-100 rounded-lg bg-white shadow-sm">
                     <span className="font-semibold text-slate-800 block line-clamp-2 text-sm">{task.title}</span>
                     <div className="flex flex-wrap justify-between items-center mt-2 gap-2">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                          {task.project?.name || 'Mục tiêu chung'}
                        </span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                          task.status === 'DONE' ? 'text-green-700 bg-green-100' : 
                          task.status === 'IN_PROGRESS' ? 'text-blue-700 bg-blue-100' : 'text-slate-600 bg-slate-100'
                        }`}>
                          {task.status.replace(/_/g, ' ')}
                        </span>
                     </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                <p className="text-slate-500 text-sm">No tasks assigned globally.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
