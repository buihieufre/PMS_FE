import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuthStore } from '@/store/authStore';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Power,
  PowerOff,
  ShieldAlert,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import RoleAssignModal from '@/components/Modal/RoleAssignModal';
import CreateUserModal from '@/components/Modal/CreateUserModal';
import ImportUsersCsvModal from '@/components/Modal/ImportUsersCsvModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuthStore() as { user: any };

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [listMeta, setListMeta] = useState({ total: 0, overallTotal: 0, totalPages: 0 });
  const [listNonce, setListNonce] = useState(0);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [sortByStatus, setSortByStatus] = useState<'default' | 'active_first' | 'locked_first'>(
    'default'
  );
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [page, setPage] = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 320);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!user) return;
    if (user?.role !== 'ADMIN') {
      toast.error('Bạn không có quyền truy cập trang này');
      router.push('/unauthorized');
    } else {
      setIsAuthorized(true);
    }
  }, [user, router]);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    (async () => {
      try {
        const [roleRes, deptRes] = await Promise.all([
          axiosInstance.get('/roles'),
          axiosInstance.get('/departments'),
        ]);
        if (!cancelled) {
          setRoles(roleRes.data);
          setDepartments(deptRes.data);
        }
      } catch {
        if (!cancelled) toast.error('Không thể tải vai trò / phòng ban');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  const refreshUserList = useCallback(() => {
    setListNonce((n) => n + 1);
  }, []);

  const fetchUserList = useCallback(async () => {
    if (!isAuthorized) return;
    setListLoading(true);
    try {
      const { data } = await axiosInstance.get('/users', {
        params: {
          page,
          pageSize,
          search: debouncedSearch || undefined,
          role: filterRole || undefined,
          departmentId: filterDepartment || undefined,
          status: filterActive,
          sort: sortByStatus,
        },
      });
      setUsers(data.data ?? []);
      setListMeta({
        total: data.total ?? 0,
        overallTotal: data.overallTotal ?? 0,
        totalPages: data.totalPages ?? 0,
      });
      if (typeof data.page === 'number' && data.page !== page) {
        setPage(data.page);
      }
    } catch {
      toast.error('Không thể tải danh sách người dùng');
    } finally {
      setListLoading(false);
    }
  }, [
    isAuthorized,
    page,
    pageSize,
    debouncedSearch,
    filterRole,
    filterDepartment,
    filterActive,
    sortByStatus,
    listNonce,
  ]);

  useEffect(() => {
    fetchUserList();
  }, [fetchUserList]);

  const totalFiltered = listMeta.total;
  const totalPages = listMeta.totalPages;
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const pageStart = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = totalFiltered === 0 ? 0 : Math.min(safePage * pageSize, totalFiltered);
  const overallTotal = listMeta.overallTotal;

  const handleDeactivate = async (userId: string, currentStatus: boolean) => {
    try {
      const { data } = await axiosInstance.patch(`/users/${userId}`, { isActive: !currentStatus });
      const updated = data.user;
      if (updated) {
        setSelectedUser((prev) => (prev?.id === userId && updated ? { ...prev, ...updated } : prev));
      }
      toast.success(currentStatus ? 'Đã vô hiệu hóa người dùng' : 'Đã kích hoạt lại người dùng');
      refreshUserList();
    } catch {
      toast.error('Thay đổi trạng thái thất bại');
    }
  };

  const handleGrantPO = async (userId: string) => {
    if (
      !confirm(
        'Bạn có chắc chắn muốn cấp quyền Project Owner cho người dùng này không? Họ sẽ có quyền tạo dự án tự do.'
      )
    )
      return;
    try {
      await axiosInstance.post(`/users/grant-project-owner`, { userId });
      toast.success('Đã cấp quyền Project Owner toàn cục!');
      refreshUserList();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể cấp quyền Project Owner');
    }
  };

  const afterUserMutation = () => {
    setPage(1);
    refreshUserList();
  };

  if (!isAuthorized) return null;

  return (
    <MainLayout>
      <Head>
        <title>Người dùng | PMS</title>
      </Head>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
          <p className="text-slate-500 text-sm mt-1">
            Quản lý tài khoản hệ thống, vai trò và trạng thái kích hoạt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-800 rounded-md hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm người dùng
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Tìm kiếm
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tên, email, mã nhân viên..."
              className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-300"
            />
          </div>
        </div>
        <div className="w-full sm:w-44">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Vai trò
          </label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          >
            <option value="">Tất cả vai trò</option>
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-48">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Phòng ban
          </label>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          >
            <option value="">Tất cả phòng ban</option>
            <option value="__none__">Chưa phân bổ</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-40">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Trạng thái
          </label>
          <select
            value={filterActive}
            onChange={(e) =>
              setFilterActive(e.target.value as 'all' | 'active' | 'inactive' | 'pending')
            }
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          >
            <option value="all">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="pending">Chưa kích hoạt email</option>
            <option value="inactive">Đã khóa</option>
          </select>
        </div>
        <div className="w-full sm:w-56">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            <span className="inline-flex items-center gap-1">
              <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
              Sắp xếp trạng thái
            </span>
          </label>
          <select
            value={sortByStatus}
            onChange={(e) =>
              setSortByStatus(e.target.value as 'default' | 'active_first' | 'locked_first')
            }
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          >
            <option value="default">Mặc định (theo danh sách)</option>
            <option value="active_first">
              Đã kích hoạt → Chưa kích hoạt → Đã khóa
            </option>
            <option value="locked_first">
              Đã khóa → Chưa kích hoạt → Đã kích hoạt
            </option>
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-2">
        {totalFiltered > 0 ? (
          <>
            Hiển thị <strong>{pageStart}</strong>–<strong>{pageEnd}</strong> trong{' '}
            <strong>{totalFiltered}</strong> kết quả lọc · Tổng hệ thống{' '}
            <strong>{overallTotal}</strong> người dùng
          </>
        ) : (
          <>
            <strong>0</strong> kết quả lọc · Tổng hệ thống <strong>{overallTotal}</strong> người
            dùng
          </>
        )}
      </p>

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
              {listLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Đang tải người dùng...
                  </td>
                </tr>
              ) : overallTotal === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Không có người dùng trong hệ thống.
                  </td>
                </tr>
              ) : totalFiltered === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Không có kết quả khớp bộ lọc hoặc từ khóa tìm kiếm.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-slate-100 transition-colors ${
                      u.isActive ? 'hover:bg-slate-50' : 'bg-slate-50 opacity-75'
                    }`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {u.displayName}
                      {u.employeeCode && (
                        <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          {u.employeeCode}
                        </span>
                      )}
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
                      {!u.isActive ? (
                        <span className="inline-flex items-center text-xs font-medium text-red-600">
                          <span className="w-2 h-2 mr-1.5 bg-red-500 rounded-full" /> Đã khóa
                        </span>
                      ) : u.isVerified === false ? (
                        <span className="inline-flex items-center text-xs font-medium text-amber-700">
                          <span className="w-2 h-2 mr-1.5 bg-amber-500 rounded-full" /> Chưa kích hoạt
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-green-600">
                          <span className="w-2 h-2 mr-1.5 bg-green-500 rounded-full" /> Đang hoạt động
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleGrantPO(u.id)}
                          title="Cấp quyền Project Owner"
                          className="p-1.5 text-yellow-600 bg-yellow-50 rounded hover:bg-yellow-100 transition-colors"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setIsRoleModalOpen(true);
                          }}
                          title="Sửa vai trò"
                          className="p-1.5 text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(u.id, u.isActive)}
                          title={u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                          className={`p-1.5 rounded transition-colors ${
                            u.isActive
                              ? 'text-red-600 bg-red-50 hover:bg-red-100'
                              : 'text-green-600 bg-green-50 hover:bg-green-100'
                          }`}
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
        {!listLoading && totalFiltered > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/80">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <label htmlFor="users-page-size" className="whitespace-nowrap">
                Số dòng / trang
              </label>
              <select
                id="users-page-size"
                value={pageSize}
                onChange={(e) =>
                  setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                }
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Trước
              </button>
              <span className="text-sm text-slate-600 tabular-nums px-2">
                Trang <strong>{safePage}</strong> / <strong>{Math.max(totalPages, 1)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={totalPages === 0 || safePage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                Sau
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>

      <RoleAssignModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        userToEdit={selectedUser}
        roles={roles}
        departments={departments}
        onSuccess={refreshUserList}
      />

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        roles={roles}
        departments={departments}
        onSuccess={afterUserMutation}
      />

      <ImportUsersCsvModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={afterUserMutation}
      />
    </MainLayout>
  );
}
