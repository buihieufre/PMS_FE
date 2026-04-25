import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

interface RoleAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit: any;
  roles: any[];
  departments: any[];
  onSuccess: () => void;
}

export default function RoleAssignModal({ isOpen, onClose, userToEdit, roles, departments, onSuccess }: RoleAssignModalProps) {
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userToEdit) {
      setRoleId(userToEdit.roleId || '');
      setDepartmentId(userToEdit.departmentId || '');
      setDisplayName(userToEdit.displayName || '');
    }
  }, [userToEdit]);

  if (!isOpen || !userToEdit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleId) return;
    
    setIsSubmitting(true);
    try {
      await axiosInstance.patch(`/users/${userToEdit.id}`, { 
        roleId, 
        departmentId: departmentId || null,
        displayName 
      });
      toast.success('Cập nhật thông tin người dùng thành công');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Cập nhật vai trò thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Sửa thông tin người dùng</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-slate-500 mb-4">
            Chỉnh sửa thông tin cho <span className="font-semibold text-slate-800">{userToEdit.email}</span>.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tên hiển thị
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Vai trò hệ thống
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="" disabled>Chọn một vai trò...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phòng ban <span className="text-slate-400 text-xs font-normal">(Tùy chọn)</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="">-- Không có phòng ban --</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (roleId === (userToEdit.roleId || '') && departmentId === (userToEdit.departmentId || '') && displayName === userToEdit.displayName)}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 border border-transparent rounded-md hover:bg-slate-800 transition-colors flex items-center disabled:opacity-70"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
