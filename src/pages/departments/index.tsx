import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { Building2, Plus, Users, Search, Pencil, LayoutGrid, List as ListIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import CreateEditDepartmentModal from '@/components/Modal/CreateEditDepartmentModal';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';

export default function DepartmentsPage() {
  const router = useRouter();
  const { user } = useAuthStore() as { user: any };
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  
  // View & Pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);

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
      toast.error('Không thể tải dữ liệu phòng ban');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) fetchDepartments();
  }, [isAuthorized]);

  // Derived state for filtering and pagination
  const filteredDepts = useMemo(() => {
    return departments.filter(d => 
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [departments, searchTerm]);

  const itemsPerPage = viewMode === 'grid' ? 9 : 10;
  const totalPages = Math.ceil(filteredDepts.length / itemsPerPage) || 1;
  
  // Reset to page 1 if searching changes total pages
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode]);

  const paginatedDepts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDepts.slice(start, start + itemsPerPage);
  }, [filteredDepts, currentPage, itemsPerPage]);

  const openCreateModal = () => {
    setEditData(null);
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, dept: any) => {
    e.preventDefault();
    e.stopPropagation();
    setEditData(dept);
    setIsModalOpen(true);
  };

  if (!isAuthorized) return null;

  return (
    <MainLayout>
      <Head>
        <title>Phòng ban | PMS</title>
      </Head>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between py-2 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Phòng ban</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý cơ cấu tổ chức công ty</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center font-medium transition-colors shadow-sm"
        >
          <Plus className="mr-2 h-5 w-5" />
          Tạo phòng ban
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-md w-full relative">
          <input 
            type="text" 
            placeholder="Tìm kiếm phòng ban..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
        </div>

        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="Chế độ lưới"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="Chế độ danh sách"
          >
            <ListIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : filteredDepts.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedDepts.map((dept) => (
                <Link key={dept.id} href={`/departments/${dept.id}`}>
                  <div className="group bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer h-full flex flex-col relative">
                    <button 
                      onClick={(e) => openEditModal(e, dept)}
                      className="absolute top-4 right-4 p-2 bg-white text-slate-400 border border-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 z-10"
                      title="Chỉnh sửa phòng ban"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <h2 className="ml-4 text-xl font-bold text-slate-800 pr-8 truncate">{dept.name}</h2>
                    </div>
                    
                    <p className="text-slate-600 text-sm mb-6 flex-1 line-clamp-3">
                      {dept.description || 'Chưa có mô tả chức năng.'}
                    </p>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-sm">
                      <div className="flex items-center text-slate-500">
                        <Users className="h-4 w-4 mr-1.5" />
                        <span className="font-medium">{dept._count?.users || 0} Thành viên</span>
                      </div>
                      <div className="text-slate-500">
                        <span className="font-medium mr-1">{dept._count?.tasks || 0}</span>Công việc
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Tên phòng ban</th>
                      <th className="px-6 py-4 font-semibold">Mô tả</th>
                      <th className="px-6 py-4 font-semibold text-center w-32">Thành viên</th>
                      <th className="px-6 py-4 font-semibold text-center w-32">Công việc</th>
                      <th className="px-6 py-4 font-semibold text-right w-24">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedDepts.map((dept) => (
                      <tr key={dept.id} className="hover:bg-slate-50 group cursor-pointer" onClick={() => router.push(`/departments/${dept.id}`)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-3 shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-slate-800">{dept.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                          {dept.description || '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                            {dept._count?.users || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                            {dept._count?.tasks || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => openEditModal(e, dept)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-sm">
              <span className="text-sm text-slate-500">
                Hiển thị <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredDepts.length)}</span> trong <span className="font-semibold text-slate-800">{filteredDepts.length}</span> phòng ban
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center px-2 gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                        currentPage === i + 1 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Không tìm thấy phòng ban</h3>
          <p className="text-slate-500">
            {searchTerm ? 'Thử thay đổi từ khóa tìm kiếm.' : 'Bắt đầu bằng cách tạo phòng ban đầu tiên của bạn.'}
          </p>
        </div>
      )}

      {isModalOpen && (
        <CreateEditDepartmentModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchDepartments}
          initialData={editData}
        />
      )}
    </MainLayout>
  );
}
