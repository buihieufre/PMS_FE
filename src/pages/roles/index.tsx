import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuthStore } from '@/store/authStore';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, Shield } from 'lucide-react';
import CreateEditRoleModal from '@/components/Modal/CreateEditRoleModal';
import ConfirmModal from '@/components/Modal/ConfirmModal';

export default function RolesPage() {
  const router = useRouter();
  const { user } = useAuthStore() as { user: any };

  const [roles, setRoles] = useState<any[]>([]);
  const [permissionsGrouped, setPermissionsGrouped] = useState<{ [group: string]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return; // wait for hydration
    if (user?.role !== 'ADMIN') {
      toast.error("Bạn không có quyền truy cập trang này");
      router.push('/unauthorized');
    } else {
      setIsAuthorized(true);
    }
  }, [user, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [roleRes, permRes] = await Promise.all([
        axiosInstance.get('/roles'),
        axiosInstance.get('/permissions')
      ]);
      setRoles(roleRes.data);
      setPermissionsGrouped(permRes.data);
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu vai trò');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) fetchData();
  }, [isAuthorized]);

  const handleDelete = async () => {
    if (!roleToDelete) return;
    try {
      await axiosInstance.delete(`/roles/${roleToDelete}`);
      toast.success('Đã xóa vai trò thành công');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Xóa vai trò thất bại');
    } finally {
      setRoleToDelete(null);
    }
  };

  const openCreateDialog = () => {
    setSelectedRole(null);
    setIsModalOpen(true);
  };

  const openEditDialog = (role: any) => {
    setSelectedRole(role);
    setIsModalOpen(true);
  };

  if (!isAuthorized) return null; // Prevent flicker

  return (
    <MainLayout>
      <Head>
        <title>Vai trò | PMS</title>
      </Head>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý vai trò</h1>
          <p className="text-slate-500 text-sm mt-1">Cấu hình các vai trò RBAC và ánh xạ quyền hạn hệ thống.</p>
        </div>
        <button 
          onClick={openCreateDialog}
          className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tạo vai trò
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-700">
              <tr>
                <th className="px-6 py-4">Tên vai trò</th>
                <th className="px-6 py-4">Mô tả</th>
                <th className="px-6 py-4">Quyền hạn kích hoạt</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Đang tải vai trò...</td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Không tìm thấy vai trò.</td>
                </tr>
              ) : (
                roles.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center">
                      <Shield className="h-4 w-4 mr-2 text-blue-600" />
                      {r.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{r.description || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {r.permissions?.length || 0} hành động được phép
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => openEditDialog(r)}
                          title="Sửa" 
                          className="p-1.5 text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setRoleToDelete(r.id)}
                          title="Xóa"
                          className="p-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateEditRoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        roleToEdit={selectedRole}
        permissionsGrouped={permissionsGrouped}
        onSuccess={fetchData}
      />

      <ConfirmModal
        isOpen={!!roleToDelete}
        title="Xóa vai trò"
        description="Bạn có chắc chắn muốn xóa hoàn toàn vai trò này không? Điều này có thể gây ra hành vi không mong đợi nếu người dùng vẫn đang sử dụng vai trò này. Hãy thận trọng."
        onConfirm={handleDelete}
        onCancel={() => setRoleToDelete(null)}
      />
    </MainLayout>
  );
}
