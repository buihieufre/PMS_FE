import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '@/components/Modal/ConfirmModal';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  deadline?: string;
  assigneeId?: string;
}

export default function TaskList() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const fetch = async () => {
      try {
        const res = await axiosInstance.get(`/projects/${projectId}/tasks`);
        setTasks(res.data);
      } catch (err) {
        toast.error('Không thể tải công việc');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projectId]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(`/projects/${projectId}/tasks/${deleteId}`);
      toast.success('Đã xóa công việc');
      setTasks((prev) => prev.filter((t) => t.id !== deleteId));
    } catch (err) {
      toast.error('Xóa thất bại');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <MainLayout><div className="p-8">Đang tải công việc...</div></MainLayout>;

  return (
    <MainLayout>
      <Head>
        <title>Danh sách công việc | PMS</title>
      </Head>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Công việc</h1>
        <Link
          href={`/projects/${projectId}/tasks/new`}
          className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-sm font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Công việc mới
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-700">
            <tr>
              <th className="px-6 py-4">Tiêu đề</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4">Hạn chót</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Không tìm thấy công việc.</td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <Link href={`/projects/${projectId}/tasks/${task.id}`}>{task.title}</Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                      task.status === 'DONE' ? 'text-green-700 bg-green-100' : 
                      task.status === 'IN_PROGRESS' ? 'text-blue-700 bg-blue-100' : 'text-slate-600 bg-slate-100'
                    }`}>
                      {task.status === 'DONE' ? 'ĐÃ HOÀN THÀNH' : task.status === 'IN_PROGRESS' ? 'ĐANG THỰC HIỆN' : 'CHỜ XỬ LÝ'}
                    </span>
                  </td>
                  <td className="px-6 py-4">{task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link href={`/projects/${projectId}/tasks/${task.id}/edit`}>
                      <button title="Sửa" className="p-1 text-slate-600 hover:text-slate-900">
                        <Edit className="h-4 w-4" />
                      </button>
                    </Link>
                    <button
                      onClick={() => setDeleteId(task.id)}
                      title="Xóa"
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Xóa công việc"
        description="Bạn có chắc chắn muốn xóa công việc này không? Hành động này không thể hoàn tác."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </MainLayout>
  );
}
