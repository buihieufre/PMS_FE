import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import MainLayout from '@/components/Layout/MainLayout';
import { toast } from 'sonner';
import { Upload, X, Save, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRef, useCallback, useMemo } from 'react';
import { getEditorTools } from '@/lib/editorTools';

const EditorJs = dynamic(
  () => import('react-editor-js').then((mod) => mod.createReactEditorJS()),
  { ssr: false }
);

interface Attachment {
  id: string;
  fileUrl: string;
  fileName: string;
}

export default function EditProject() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };
  const [name, setName] = useState('');
  const [descriptionData, setDescriptionData] = useState<any>(null);
  const editorCore = useRef<any>(null);
  const tools = useMemo(() => getEditorTools(), []);

  const handleInitialize = useCallback((instance: any) => {
    editorCore.current = instance;
  }, []);

  const [attachments, setAttachments] = useState<{ file: File; customName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [initialName, setInitialName] = useState('');
  const [initialDescription, setInitialDescription] = useState('');
  const [descriptionDirty, setDescriptionDirty] = useState(false);

  // Load existing project data
  useEffect(() => {
    if (!projectId) return;
    const fetch = async () => {
      try {
        const res = await axiosInstance.get(`/projects/${projectId}`);
        const proj = res.data;
        setName(proj.name);
        setInitialName(proj.name || '');
        try {
          const parsed = JSON.parse(proj.description);
          setDescriptionData(parsed);
          setInitialDescription(JSON.stringify(parsed || { blocks: [] }));
        } catch {
          // Wrap old plain text in an initial block
          const fallbackData = {
            blocks: [
              {
                type: 'paragraph',
                data: { text: proj.description },
              },
            ],
          };
          setDescriptionData(fallbackData);
          setInitialDescription(JSON.stringify(fallbackData));
        }
        // Existing attachments are shown as placeholders (no file objects)
        // We will let user replace all by uploading new files (replace strategy)
      } catch (err) {
        toast.error('Failed to load project');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projectId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        file,
        customName: file.name.split('.')[0],
      }));
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCustomName = (index: number, newName: string) => {
    setAttachments((prev) => {
      const copy = [...prev];
      copy[index].customName = newName;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    try {
      let descStr = '';
      if (editorCore.current) {
        const savedData = await editorCore.current.save();
        descStr = JSON.stringify(savedData);
      }

      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', descStr);

      attachments.forEach((att) => {
        formData.append('files', att.file);
        formData.append('customNames', att.customName);
      });

      await axiosInstance.patch(`/projects/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Đã cập nhật dự án');
      router.push(`/projects/${projectId}`);
    } catch (err) {
      toast.error('Cập nhật thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditorChange = useCallback(async () => {
    if (!editorCore.current) return;
    try {
      const savedData = await editorCore.current.save();
      const current = JSON.stringify(savedData || { blocks: [] });
      setDescriptionDirty(current !== initialDescription);
    } catch {
      // ignore editor transient save errors
    }
  }, [initialDescription]);

  const hasChanges =
    name.trim() !== initialName.trim() ||
    descriptionDirty ||
    attachments.length > 0;

  if (loading) return <MainLayout><div className="p-8">Đang tải...</div></MainLayout>;

  return (
    <MainLayout>
      <Head>
        <title>{name ? `Cập nhật - ${name} | PMS` : 'Cập nhật | PMS'}</title>
      </Head>
      <div className="mb-6 flex items-center space-x-4">
        <Link href={`/projects/${projectId}`} className="p-2 bg-white rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chỉnh sửa dự án</h1>
          <p className="text-slate-500 text-sm mt-1">Cập nhật thông tin dự án và tệp đính kèm.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm max-w-3xl">
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên dự án <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Ví dụ: Nâng cấp hệ thống nội bộ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả <span className="text-red-500">*</span></label>
              <div className="prose max-w-none w-full border border-slate-300 rounded-md p-4 bg-white min-h-[150px] focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900">
                <EditorJs
                  onInitialize={handleInitialize}
                  onChange={handleEditorChange}
                  defaultValue={descriptionData || { blocks: [] }}
                  placeholder="Nhập mô tả chi tiết mục tiêu dự án..."
                  tools={tools as any}
                />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-slate-700">Tệp đính kèm dự án</label>
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-md text-sm font-medium flex items-center transition-colors">
                  <Upload className="h-4 w-4 mr-2" />
                  Select Files
                  <input type="file" multiple className="hidden" onChange={handleFileChange} />
                </label>
              </div>
              {attachments.length > 0 && (
                <div className="space-y-3 mt-4">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 mb-1 block">Tên hiển thị tùy chỉnh</label>
                        <input
                          type="text"
                          value={att.customName}
                          onChange={(e) => updateCustomName(idx, e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:border-slate-500"
                        />
                      </div>
                      <div className="w-1/3 truncate text-xs text-slate-400 self-end pb-2">
                        {att.file.name} ({(att.file.size / 1024 / 1024).toFixed(2)}MB)
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="self-end mb-1 p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="pt-6 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}`)}
              className="py-2 px-4 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm"
              disabled={isSaving}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!hasChanges || isSaving}
              className="py-2 px-4 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-medium text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
