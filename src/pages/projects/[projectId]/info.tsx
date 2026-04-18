import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { Paperclip, FileText, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { getEditorTools } from '@/lib/editorTools';

// Next.js SSR workaround for Editor.js (requires window)
const EditorJsViewer = dynamic(
  () => import('react-editor-js').then((mod) => mod.createReactEditorJS()),
  { ssr: false }
);



interface Attachment {
  id: string;
  fileUrl: string;
  fileName: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  projectAttachments: Attachment[];
}

export default function ProjectDetailInfo() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };

  // Ensure the dynamic route param is available before fetching
  if (!router.isReady) {
    return <MainLayout><div className="p-8">Loading...</div></MainLayout>;
  }

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const tools = useMemo(() => getEditorTools(), []);

  useEffect(() => {
    if (!projectId) return;
    const fetch = async () => {
      try {
        const res = await axiosInstance.get(`/projects/${projectId}`);
        setProject(res.data);
      } catch (err) {
        toast.error('Failed to load project info');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projectId]);



  if (loading) return <MainLayout><div className="p-8">Loading...</div></MainLayout>;
  if (!project) return <MainLayout><div className="p-8">Project not found.</div></MainLayout>;

  return (
    <MainLayout>
      <Head>
        <title>{project ? `${project.name} - Thông tin | PMS` : 'Thông tin | PMS'}</title>
      </Head>
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <div className="mb-6 flex items-center space-x-4">
          <Link href={`/projects/${projectId}`} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">{project.name} - Info</h1>
        </div>
        {/* Render description using Editor.js (read‑only) */}
        {(() => {
          try {
            const data = JSON.parse(project.description);
            return (
              <div className="prose max-w-none text-slate-700 mb-4">
                <EditorJsViewer
                  defaultValue={data}
                  readOnly={true}
                  tools={tools as any}
                />
              </div>
            );
          } catch {
            // Nếu không phải JSON (dữ liệu cũ), hiển thị dạng văn bản bình thường
            return <p className="text-slate-700 mb-4 whitespace-pre-wrap">{project.description}</p>;
          }
        })()}
        <h2 className="text-xl font-semibold mb-2">Attachments</h2>
        {project.projectAttachments && project.projectAttachments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {project.projectAttachments.map((att) => {
              const ext = att.fileName.split('.').pop()?.toLowerCase();
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
              
              return (
                <a
                  key={att.id}
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 mr-4 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                    {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                      {att.fileName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium uppercase tracking-wider">
                      {ext || 'FILE'}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500">No attachments.</p>
        )}
      </div>
    </MainLayout>
  );
}
