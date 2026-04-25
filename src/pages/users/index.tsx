import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuthStore } from '@/store/authStore';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { Pencil, Power, PowerOff, ShieldAlert, Plus } from 'lucide-react';
import RoleAssignModal from '@/components/Modal/RoleAssignModal';
import CreateUserModal from '@/components/Modal/CreateUserModal';

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuthStore() as { user: any };

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
      const [userRes, roleRes, deptRes] = await Promise.all([
        axiosInstance.get('/users'),
        axiosInstance.get('/roles'),
        axiosInstance.get('/departments')
      ]);
      setUsers(userRes.data);
      setRoles(roleRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) fetchData();
  }, [isAuthorized]);

  const handleDeactivate = async (userId: string, currentStatus: boolean) => {
    try {
      await axiosInstance.patch(`/users/${userId}`, { isActive: !currentStatus });
      toast.success(currentStatus ? 'Đã vô hiệu hóa người dùng' : 'Đ đã kích hoạt lại người dùng');
      fetchData();
    } catch (err) {
      toast.error('Thay đổi trạng thái thất bại');
    }
  };

  const handleGrantPO = async (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn cấp quyền Project Owner cho người dùng này không? Họ sẽ có quyền tạo dự án tự do.')) return;
    try {
      await axiosInstance.post(`/users/grant-project-owner`, { userId });
      toast.success('Đã cấp quyền Project Owner toàn cục!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể cấp quyền Project Owner');
    }
  };

  if (!isAuthorized) return null; // Prevent flicker

  return (
    <MainLayout>
      <Head>
        <title>Người dùng | PMS</title>
      </Head>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý tài khoản hệ thống, vai trò và trạng thái kích hoạt.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm người dùng
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-700">
              <tr>
                <th className="px-6 py-4">Người dùng</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phòng ban</th>
                <th className="px-6 py-4">Vai trò hệ thống</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Đang tải người dùng...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Không tìm thấy người dùng.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={`border-b border-slate-100 transition-colors ${u.isActive ? 'hover:bg-slate-50' : 'bg-slate-50 opacity-75'}`}>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {u.displayName}
                      {u.employeeCode && <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{u.employeeCode}</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       {u.department ? (
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                           {u.department.name}
                         </span>
                       ) : (
                         <span className="text-xs text-slate-400 italic">Chưa phân bổ</span>
                       )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {u.role || 'Không có vai trò'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       {u.isActive ? (
                         <span className="inline-flex items-center text-xs font-medium text-green-600"><span className="w-2 h-2 mr-1.5 bg-green-500 rounded-full"></span> Đang hoạt động</span>
                       ) : (
                         <span className="inline-flex items-center text-xs font-medium text-red-600"><span className="w-2 h-2 mr-1.5 bg-red-500 rounded-full"></span> Đã khóa</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                         <button 
                          onClick={() => handleGrantPO(u.id)}
                          title="Cấp quyền Project Owner"
                          className="p-1.5 text-yellow-600 bg-yellow-50 rounded hover:bg-yellow-100 transition-colors"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => { setSelectedUser(u); setIsRoleModalOpen(true); }}
                          title="Sửa vai trò" 
                          className="p-1.5 text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeactivate(u.id, u.isActive)}
                          title={u.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                          className={`p-1.5 rounded transition-colors ${u.isActive ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-green-600 bg-green-50 hover:bg-green-100'}`}
                        >
                          {u.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
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

      <RoleAssignModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        userToEdit={selectedUser}
        roles={roles}
        departments={departments}
        onSuccess={fetchData}
      />

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        roles={roles}
        departments={departments}
        onSuccess={fetchData}
      />
    </MainLayout>
  );
}
