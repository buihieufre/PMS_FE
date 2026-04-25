import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Loader2, Search, UserPlus } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  role: string;
  isActive?: boolean;
};

interface AddDepartmentMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId: string;
  departmentName: string;
  onSuccess: () => void;
}

function toggleInSet<T>(set: Set<T>, key: T, on: boolean): Set<T> {
  const n = new Set(set);
  if (on) n.add(key);
  else n.delete(key);
  return n;
}

export default function AddDepartmentMemberModal({
  isOpen,
  onClose,
  departmentId,
  departmentName,
  onSuccess
}: AddDepartmentMemberModalProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setSelectedIds(new Set());
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get<UserRow[]>('/users');
        if (!cancelled) setUsers(res.data || []);
      } catch {
        if (!cancelled) toast.error('Không tải được danh sách người dùng');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const candidates = useMemo(() => {
    return users.filter(
      (u) => u.departmentId !== departmentId && u.isActive !== false
    );
  }, [users, departmentId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role && String(u.role).toLowerCase().includes(q))
    );
  }, [candidates, search]);

  const selectedCount = selectedIds.size;
  const filteredIds = useMemo(() => new Set(filtered.map((u) => u.id)), [filtered]);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));

  const selectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      filtered.forEach((u) => n.add(u.id));
      return n;
    });
  }, [filtered]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const clearFilteredFromSelection = useCallback(() => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      filtered.forEach((u) => n.delete(u.id));
      return n;
    });
  }, [filtered]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => toggleInSet(prev, id, !prev.has(id)));
  };

  const handleAddSelected = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    const ids = Array.from(selectedIds);
    try {
      const results = await Promise.allSettled(
        ids.map((userId) =>
          axiosInstance.patch(`/users/${userId}`, { departmentId })
        )
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;

      if (ok > 0) onSuccess();
      if (ok === results.length) {
        toast.success(
          `Đã thêm ${ok} ${ok === 1 ? 'người' : 'người'} vào ${departmentName}`
        );
        onClose();
      } else if (ok > 0) {
        toast.warning(
          `Đã thêm ${ok}/${results.length} người. ${fail} thất bại — bạn có thể thử lại.`
        );
        onClose();
      } else {
        toast.error('Không thể thêm. Vui lòng thử lại.');
      }
    } catch {
      toast.error('Có lỗi khi thêm hàng loạt');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Thêm thành viên</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tích nhiều người, rồi bấm <span className="font-medium">Thêm đã chọn</span> — gán vào{' '}
              <span className="font-medium text-slate-700">{departmentName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100"
            aria-label="Đóng"
            disabled={submitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 pb-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 text-xs">
            <span className="text-slate-600">
              Đã chọn: <span className="font-bold text-slate-900">{selectedCount}</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={allFilteredSelected ? clearFilteredFromSelection : selectAllFiltered}
                className="font-medium text-indigo-600 hover:text-indigo-800"
              >
                {allFilteredSelected
                  ? 'Bỏ chọn danh sách này'
                  : 'Chọn tất cả trong tìm kiếm'}
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="font-medium text-slate-500 hover:text-slate-800"
                >
                  Bỏ tất cả
                </button>
              )}
            </div>
          </div>
        )}

        <div className="max-h-[min(380px,50vh)] overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {candidates.length === 0
                ? 'Không còn người dùng nào để thêm (mọi tài khoản đang hoạt động đã thuộc phòng ban này).'
                : 'Không khớp kết quả tìm kiếm.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((u) => {
                const selected = selectedIds.has(u.id);
                return (
                  <li key={u.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        selected
                          ? 'border-indigo-200 bg-indigo-50/90'
                          : 'border-slate-100 bg-slate-50/80 hover:border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleOne(u.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{u.displayName}</p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
                            {u.role || 'USER'}
                          </span>
                          {u.department && (
                            <span className="text-[10px] text-amber-700">Đang ở: {u.department.name}</span>
                          )}
                          {!u.departmentId && (
                            <span className="text-[10px] text-slate-500">Chưa có phòng ban</span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 p-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="order-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:order-1 sm:min-w-[100px] disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={selectedCount === 0 || submitting}
            className="order-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:order-2 sm:min-w-[200px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Thêm đã chọn{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
