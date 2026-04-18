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
      toast.error('Failed to load projects');
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
      toast.success('Project deleted successfully');
      setProjectToDelete(null);
      fetchProjects();
    } catch (err) {
      toast.error('Failed to delete project');
    }
  };

  const getPreviewText = (desc: string) => {
    if (!desc) return '';
    try {
      const data = JSON.parse(desc);
      if (data.blocks && data.blocks.length > 0) {
        const pBlock = data.blocks.find((b: any) => b.type === 'paragraph');
        // Strip out simple HTML tags that EditorJS might produce
        return pBlock ? pBlock.data.text.replace(/<[^>]*>?/gm, '') : 'Structured description...';
      }
      return 'No description';
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
        title="Projects"
        description="Manage all your active and past projects."
        actions={
          <button 
            onClick={() => router.push('/projects/new')}
            className="flex items-center px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-700">
              <tr>
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading projects...</td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No projects found. Create one to get started.</td>
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
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setProjectToDelete(null)}
      />
    </>
  );
}
