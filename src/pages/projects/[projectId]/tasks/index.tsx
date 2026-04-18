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
        toast.error('Failed to load tasks');
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
      toast.success('Task deleted');
      setTasks((prev) => prev.filter((t) => t.id !== deleteId));
    } catch (err) {
      toast.error('Delete failed');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <MainLayout><div className="p-8">Loading tasks...</div></MainLayout>;

  return (
    <MainLayout>
      <Head>
        <title>Danh sách công việc | PMS</title>
      </Head>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        <Link
          href={`/projects/${projectId}/tasks/new`}
          className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-sm font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-700">
            <tr>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Deadline</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No tasks found.</td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <Link href={`/projects/${projectId}/tasks/${task.id}`}>{task.title}</Link>
                  </td>
                  <td className="px-6 py-4 capitalize">{task.status?.toLowerCase()}</td>
                  <td className="px-6 py-4">{task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link href={`/projects/${projectId}/tasks/${task.id}/edit`}>
                      <button className="p-1 text-slate-600 hover:text-slate-900">
                        <Edit className="h-4 w-4" />
                      </button>
                    </Link>
                    <button
                      onClick={() => setDeleteId(task.id)}
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
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </MainLayout>
  );
}
