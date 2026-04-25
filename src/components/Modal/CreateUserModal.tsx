import { useState } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: any[];
  departments: any[];
  onSuccess: () => void;
}

export default function CreateUserModal({ isOpen, onClose, roles, departments, onSuccess }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName || !roleId) {
      toast.error('Vui lòng điền tất cả các trường bắt buộc');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await axiosInstance.post(`/users/admin-create`, { 
        email, 
        displayName, 
        roleId, 
        departmentId: departmentId || null 
      });
      toast.success('Đã gửi lời mời thành công! Email đã được phát đi.');
      onSuccess();
      onClose();
      // Reset form
      setEmail('');
      setDisplayName('');
      setRoleId('');
      setDepartmentId('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Không thể tạo người dùng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Mời thành viên mới</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-slate-500 mb-6">
            Tạo tài khoản và gửi email kích hoạt chứa mật khẩu tạm thời.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Địa chỉ Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dong-nghiep@congty.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tên hiển thị <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Vai trò hệ thống <span className="text-red-500">*</span>
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phòng ban toàn cục <span className="text-slate-400 text-xs font-normal">(Tùy chọn)</span>
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
          </div>

          <div className="flex justify-end gap-3 pt-6 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 border border-transparent rounded-md hover:bg-slate-800 transition-colors flex items-center disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Gửi lời mời
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
