import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import axiosInstance from '@/lib/axios';
import { Plus, Eye, Pencil, Trash2, Layout as LayoutIcon } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/Layout/PageHeader';
import ConfirmModal from '@/components/Modal/ConfirmModal';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const response = await axiosInstance.get('/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
      toast.error('Không thể tải danh sách dự án');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async () => {
    if (!projectToDelete) return;
    try {
      await axiosInstance.delete(`/projects/${projectToDelete}`);
      toast.success('Dự án đã được xóa thành công');
      setProjectToDelete(null);
      fetchProjects();
    } catch (err) {
      toast.error('Xóa dự án thất bại');
    }
  };

  const getPreviewText = (desc: string) => {
    if (!desc) return '';
    try {
      const data = JSON.parse(desc);
      if (data.blocks && data.blocks.length > 0) {
        const pBlock = data.blocks.find((b: any) => b.type === 'paragraph');
        // Strip out simple HTML tags that EditorJS might produce
        return pBlock ? pBlock.data.text.replace(/<[^>]*>?/gm, '') : 'Mô tả chi tiết...';
      }
      return 'Không có mô tả';
    } catch {
      return desc;
    }
  };

  return (
    <>
      <Head>
        <title>Quản lý dự án | PMS</title>
      </Head>
      <MainLayout>
      <PageHeader 
        title="Dự án"
        description="Quản lý tất cả các dự án đang hoạt động và đã qua."
        actions={
          <button 
            onClick={() => router.push('/projects/new')}
            className="flex items-center px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tạo dự án mới
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-700">
              <tr>
                <th className="px-6 py-4">Tên dự án</th>
                <th className="px-6 py-4">Mô tả</th>
                <th className="px-6 py-4">Ngày tạo</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Đang tải danh sách dự án...</td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Không tìm thấy dự án nào. Hãy tạo mới để bắt đầu.</td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <Link href={`/projects/${project.id}`} className="hover:underline">
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{getPreviewText(project.description)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <Link href={`/projects/${project.id}/info`} title="View details" className="p-1.5 text-blue-600 bg-blue-50 rounded bg-opacity-70 hover:bg-blue-100 transition-colors">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link href={`/projects/${project.id}/edit`} title="Edit" className="p-1.5 text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button 
                          onClick={() => setProjectToDelete(project.id)}
                          title="Delete"
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
    </MainLayout>
      <ConfirmModal
        isOpen={!!projectToDelete}
        title="Xóa dự án"
        description="Bạn có chắc chắn muốn xóa dự án này? Hành động này không thể hoàn tác."
        onConfirm={handleDelete}
        onCancel={() => setProjectToDelete(null)}
      />
    </>
  );
}
