import { useEffect, useState } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { Building2, Plus, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import CreateDepartmentModal from '@/components/Modal/CreateDepartmentModal';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';

export default function DepartmentsPage() {
  const router = useRouter();
  const { user } = useAuthStore() as { user: any };
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return; // wait for hydration
    if (user?.role !== 'ADMIN') {
      toast.error("Bạn không có quyền truy cập trang này");
      router.push('/unauthorized');
    } else {
      setIsAuthorized(true);
    }
  }, [user, router]);

  const fetchDepartments = async () => {
    try {
      const res = await axiosInstance.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) fetchDepartments();
  }, [isAuthorized]);

  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isAuthorized) return null;

  return (
    <MainLayout>
      <Head>
        <title>Phòng ban | PMS</title>
      </Head>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between py-2 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Departments</h1>
          <p className="text-slate-500 text-sm mt-1">Manage company organizational structure</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center font-medium transition-colors shadow-sm"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Department
        </button>
      </div>

      <div className="mb-6 max-w-md relative">
        <input 
          type="text" 
          placeholder="Search departments..."
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : filteredDepts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepts.map((dept) => (
            <Link key={dept.id} href={`/departments/${dept.id}`}>
              <div className="group bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer h-full flex flex-col">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <h2 className="ml-4 text-xl font-bold text-slate-800">{dept.name}</h2>
                </div>
                
                <p className="text-slate-600 text-sm mb-6 flex-1 line-clamp-3">
                  {dept.description || 'No function described yet.'}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-sm">
                  <div className="flex items-center text-slate-500">
                    <Users className="h-4 w-4 mr-1.5" />
                    <span className="font-medium">{dept._count?.users || 0} Members</span>
                  </div>
                  <div className="text-slate-500">
                    <span className="font-medium mr-1">{dept._count?.tasks || 0}</span>Tasks
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No departments found</h3>
          <p className="text-slate-500">Get started by creating your first global department.</p>
        </div>
      )}

      {isModalOpen && (
        <CreateDepartmentModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchDepartments}
        />
      )}
    </MainLayout>
  );
}
