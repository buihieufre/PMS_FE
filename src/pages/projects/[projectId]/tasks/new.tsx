import { useRouter } from 'next/router';
import { useState } from 'react';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewTask() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axiosInstance.post(`/projects/${projectId}/tasks`, {
        title,
        description,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        assigneeId: assigneeId || undefined,
        departmentId: departmentId || undefined,
      });
      toast.success('Task created');
      router.push(`/projects/${projectId}/tasks`);
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  return (
    <MainLayout>
      <Head>
        <title>Tạo công việc mới | PMS</title>
      </Head>
      <div className="mb-6 flex items-center space-x-4">
        <Link href={`/projects/${projectId}/tasks`} className="p-2 bg-white rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Task</h1>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm max-w-3xl">
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assignee ID (optional)</label>
            <input
              type="text"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              placeholder="User UUID"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Department ID (optional)</label>
            <input
              type="text"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Department UUID"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              Create Task
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
