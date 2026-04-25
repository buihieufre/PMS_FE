import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { ArrowLeft, Building2, Users, Settings, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import AddDepartmentMemberModal from '@/components/Modal/AddDepartmentMemberModal';
import ConfirmModal from '@/components/Modal/ConfirmModal';

export default function DepartmentDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const { user } = useAuthStore() as { user: any };
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [department, setDepartment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [removeSelectedIds, setRemoveSelectedIds] = useState<Set<string>>(() => new Set());
  const [removingBatch, setRemovingBatch] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

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
      toast.error('Không thể lấy chi tiết phòng ban');
      router.push('/departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) fetchDepartment();
  }, [id, isAuthorized]);

  const members = useMemo(
    () => (Array.isArray(department?.users) ? department!.users : []) as Array<{
      id: string;
      displayName: string;
      email: string;
      role?: { name?: string };
    }>,
    [department?.users]
  );

  useEffect(() => {
    if (!members.length) {
      setRemoveSelectedIds(new Set());
      return;
    }
    setRemoveSelectedIds((prev) => {
      const valid = new Set(members.map((m) => m.id));
      const n = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) n.add(id);
      });
      return n;
    });
  }, [members]);

  const removeSelectedCount = removeSelectedIds.size;
  const allMembersSelected = members.length > 0 && members.every((m) => removeSelectedIds.has(m.id));

  const selectAllForRemove = useCallback(() => {
    setRemoveSelectedIds(new Set(members.map((m) => m.id)));
  }, [members]);

  const clearRemoveSelection = useCallback(() => {
    setRemoveSelectedIds(new Set());
  }, []);

  const toggleRemoveOne = (userId: string) => {
    setRemoveSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(userId)) n.delete(userId);
      else n.add(userId);
      return n;
    });
  };

  const openRemoveConfirm = () => {
    if (removeSelectedCount === 0) return;
    setIsRemoveConfirmOpen(true);
  };

  const executeRemoveBatch = async () => {
    if (removeSelectedCount === 0) return;
    setRemovingBatch(true);
    const ids = Array.from(removeSelectedIds);
    try {
      const results = await Promise.allSettled(
        ids.map((userId) => axiosInstance.patch(`/users/${userId}`, { departmentId: null }))
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      await fetchDepartment();
      setRemoveSelectedIds(new Set());
      setIsRemoveConfirmOpen(false);
      if (ok === results.length) {
        toast.success(`Đã gỡ ${ok} ${ok === 1 ? 'người' : 'người'} khỏi phòng ban`);
      } else if (ok > 0) {
        toast.warning(`Đã gỡ ${ok}/${results.length} người. ${fail} thất bại.`);
      } else {
        toast.error('Không gỡ được. Vui lòng thử lại.');
      }
    } catch {
      toast.error('Có lỗi khi gỡ hàng loạt');
    } finally {
      setRemovingBatch(false);
    }
  };

  if (!router.isReady || loading) {
    return <MainLayout><div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></MainLayout>;
  }

  if (!isAuthorized || !department) return null;

  return (
    <MainLayout>
      <Head>
        <title>{department?.name || 'Phòng ban'} | PMS</title>
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
          <p className="text-slate-500 text-sm mt-1">Phòng ban công ty toàn cầu</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Panel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 col-span-1 lg:col-span-3">
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
            <Settings className="h-5 w-5 mr-2 text-slate-500" /> Chức năng phòng ban
          </h2>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 whitespace-pre-wrap text-slate-700">
            {department.description || <span className="text-slate-400 italic">Chưa cung cấp mô tả chức năng.</span>}
          </div>
        </div>

        {/* Members List */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden min-h-[24rem] max-h-[32rem] lg:max-h-[28rem] col-span-1 lg:col-span-3">
          <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-4">
            <h2 className="text-lg font-bold flex items-center text-slate-800">
              <Users className="mr-2 h-5 w-5 text-indigo-600" />
              Danh sách nhân sự
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {members.length} Thành viên
              </span>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Thêm thành viên
              </button>
            </div>
          </div>
          {members.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 sm:px-6 text-xs">
              <span className="text-slate-600">
                Đã chọn:{' '}
                <span className="font-bold text-slate-900">{removeSelectedCount}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={allMembersSelected ? clearRemoveSelection : selectAllForRemove}
                  className="font-medium text-indigo-600 hover:text-indigo-800"
                >
                  {allMembersSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <button
                  type="button"
                  onClick={openRemoveConfirm}
                  disabled={removeSelectedCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  Gỡ đã chọn{removeSelectedCount > 0 ? ` (${removeSelectedCount})` : ''}
                </button>
              </div>
            </div>
          )}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
            {members.length > 0 ? (
              <ul className="space-y-2">
                {members.map((m) => {
                  const selected = removeSelectedIds.has(m.id);
                  return (
                    <li key={m.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          selected
                            ? 'border-rose-200 bg-rose-50/50'
                            : 'border-slate-100 bg-white shadow-sm hover:border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRemoveOne(m.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800">{m.displayName}</span>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="truncate">{m.email}</span>
                            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                              {m.role?.name || 'USER'}
                            </span>
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="h-full min-h-[12rem] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 p-6 text-center">
                <Users className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">Chưa có thành viên</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Bấm &quot;Thêm thành viên&quot; để gán người dùng từ hệ thống (kể cả từ phòng ban khác).
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <UserPlus className="h-4 w-4" />
                  Thêm thành viên
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {typeof id === 'string' && (
        <AddDepartmentMemberModal
          isOpen={isAddMemberOpen}
          onClose={() => setIsAddMemberOpen(false)}
          departmentId={id}
          departmentName={department.name}
          onSuccess={fetchDepartment}
        />
      )}

      <ConfirmModal
        isOpen={isRemoveConfirmOpen}
        title="Gỡ thành viên khỏi phòng ban?"
        description={
          <div>
            <p>
              Bạn sắp gỡ{' '}
              <span className="font-semibold text-slate-900">{removeSelectedCount} người</span> khỏi phòng
              ban{' '}
              <span className="font-semibold text-slate-900">「{department.name}」</span>.
            </p>
            <p className="mt-2 text-slate-600">
              Tài khoản vẫn tồn tại; chỉ hủy gán phòng ban. Họ vẫn truy cập hệ thống bình thường theo
              quyền hiện có.
            </p>
          </div>
        }
        confirmLabel="Gỡ khỏi phòng ban"
        cancelLabel="Quay lại"
        variant="danger"
        isLoading={removingBatch}
        onConfirm={executeRemoveBatch}
        onCancel={() => setIsRemoveConfirmOpen(false)}
      />
    </MainLayout>
  );
}
