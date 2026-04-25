import { useRouter } from 'next/router';
import { useState, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { ArrowLeft, Save, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import DescriptionEditorExpandModal from '@/components/Modal/DescriptionEditorExpandModal';
import { getEditorTools } from '@/lib/editorTools';
import { parseTaskDescriptionData } from '@/lib/taskDescription';

const EditorJs = dynamic(
  () => import('react-editor-js').then((mod) => mod.createReactEditorJS()),
  { ssr: false }
);

export default function NewTask() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionExpandOpen, setDescriptionExpandOpen] = useState(false);
  const [descriptionEditorKey, setDescriptionEditorKey] = useState(0);
  const editorCore = useRef<any>(null);
  const tools = useMemo(() => getEditorTools(), []);
  const descriptionDefault = useMemo(
    () => parseTaskDescriptionData(description),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [descriptionEditorKey]
  );
  const handleInit = useCallback((core: any) => {
    editorCore.current = core;
  }, []);
  const handleChange = useCallback(async () => {
    if (!editorCore.current) return;
    try {
      const data = await editorCore.current.save();
      setDescription(JSON.stringify(data));
    } catch {
      // ignore
    }
  }, []);
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let descPayload = description;
    if (editorCore.current) {
      try {
        const saved = await editorCore.current.save();
        descPayload = JSON.stringify(saved);
      } catch (err) {
        console.error(err);
        toast.error('Không lưu được mô tả');
        return;
      }
    }
    try {
      await axiosInstance.post(`/projects/${projectId}/tasks`, {
        title,
        description: descPayload,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        assigneeId: assigneeId || undefined,
        departmentId: departmentId || undefined,
      });
      toast.success('Đã tạo công việc');
      setDescription('');
      setDescriptionEditorKey((k) => k + 1);
      router.push(`/projects/${projectId}/tasks`);
    } catch (err) {
      toast.error('Tạo công việc thất bại');
    }
  };

  return (
    <>
    <MainLayout>
      <Head>
        <title>Tạo công việc mới | PMS</title>
      </Head>
      <div className="mb-6 flex items-center space-x-4">
        <Link href={`/projects/${projectId}/tasks`} className="p-2 bg-white rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tạo công việc mới</h1>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm max-w-3xl">
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Nhập tiêu đề công việc"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">Mô tả</label>
              <button
                type="button"
                onClick={() => setDescriptionExpandOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:border-slate-300 hover:bg-white"
                title="Mở màn hình lớn để trình bày nội dung"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Mở rộng
              </button>
            </div>
            <div className="prose max-w-none w-full border border-slate-300 rounded-md p-4 bg-white min-h-[150px] focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900">
              <EditorJs
                key={descriptionEditorKey}
                onInitialize={handleInit}
                onChange={handleChange}
                defaultValue={descriptionDefault}
                placeholder="Mô tả chi tiết công việc..."
                tools={tools as any}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hạn chót</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID Người được giao (tùy chọn)</label>
            <input
              type="text"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              placeholder="Mã định danh người dùng (UUID)"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID Phòng ban (tùy chọn)</label>
            <input
              type="text"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Mã định danh phòng ban (UUID)"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              Tạo công việc
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
    <DescriptionEditorExpandModal
      isOpen={descriptionExpandOpen}
      onClose={() => setDescriptionExpandOpen(false)}
      value={description}
      title="Soạn mô tả công việc"
      onApply={(json) => {
        setDescription(json);
        setDescriptionEditorKey((k) => k + 1);
        setDescriptionExpandOpen(false);
      }}
    />
    </>
  );
}
