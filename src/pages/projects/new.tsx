import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import axiosInstance from '@/lib/axios';
import { Upload, X, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRef, useCallback, useMemo } from 'react';
import { getEditorTools } from '@/lib/editorTools';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { normalizeBoardTemplateOption, type BoardTemplateOption } from '@/lib/boardTemplateOption';
import { BoardTemplatePreview } from '@/components/Project/BoardTemplatePreview';

const EditorJs = dynamic(
  () => import('react-editor-js').then((mod) => mod.createReactEditorJS()),
  { ssr: false }
);

export default function CreateProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const editorCore = useRef<any>(null);
  const tools = useMemo(() => getEditorTools(), []);

  const handleInitialize = useCallback((instance: any) => {
    editorCore.current = instance;
  }, []);
  
  // Array of { file: File, customName: string }
  const [attachments, setAttachments] = useState<{file: File, customName: string}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [boardTemplates, setBoardTemplates] = useState<BoardTemplateOption[]>([]);
  const [boardTemplateId, setBoardTemplateId] = useState<string>('');

  const createProjectSelectedLists = useMemo(() => {
    if (!boardTemplateId) return [];
    return boardTemplates.find((t) => t.id === boardTemplateId)?.lists ?? [];
  }, [boardTemplates, boardTemplateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get('/projects/board-templates');
        if (!cancelled) {
          const list = (res.data || []).map((t: any) => normalizeBoardTemplateOption(t));
          setBoardTemplates(list);
          const def =
            list.find((t: { name?: string }) => t.name === 'Kanban gốc PMS (6 cột)') ||
            list.find((t: { isBuiltIn?: boolean; name?: string }) => t.isBuiltIn && t.name?.includes('Kanban')) ||
            list[0];
          if (def?.id) setBoardTemplateId(def.id);
        }
      } catch {
        if (!cancelled) setBoardTemplates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        customName: file.name.split('.')[0] // default custom name is filename without ext
      }));
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomName = (index: number, newName: string) => {
    setAttachments(prev => {
      const updated = [...prev];
      updated[index].customName = newName;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      let descData = '';
      if (editorCore.current) {
        const savedData = await editorCore.current.save();
        descData = JSON.stringify(savedData);
      }

      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', descData);
      if (boardTemplateId) {
        formData.append('boardTemplateId', boardTemplateId);
      }
      
      attachments.forEach((att) => {
        formData.append('files', att.file);
        // Important: this sends multiple customNames matching files array index
        formData.append('customNames', att.customName);
      });

      await axiosInstance.post('/projects', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      router.push('/projects');
    } catch (error) {
      console.error('Failed to create project', error);
      toast.error('Có lỗi xảy ra khi tạo dự án');
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <Head>
        <title>Thêm dự án mới | PMS</title>
      </Head>
      <div className="mb-6 flex items-center space-x-4">
        <Link href="/projects" className="p-2 bg-white rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tạo dự án mới</h1>
          <p className="text-slate-500 text-sm mt-1">Thiết lập chi tiết dự án và các tệp đính kèm đi kèm.</p>
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
                placeholder="v.d. Tái thiết kế Website"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template cột bảng</label>
              <select
                value={boardTemplateId}
                onChange={(e) => setBoardTemplateId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
              >
                {boardTemplates.length === 0 ? (
                  <option value="">Mặc định hệ thống</option>
                ) : (
                  boardTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isBuiltIn ? ' (hệ thống)' : ''}
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Chọn bộ cột khi tạo dự án; bạn có thể lưu template từ trang bảng công việc.
              </p>
              {boardTemplateId ? (
                <BoardTemplatePreview
                  lists={createProjectSelectedLists}
                  templateId={boardTemplateId}
                  className="mt-3"
                />
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả dự án <span className="text-red-500">*</span></label>
              <div className="prose max-w-none w-full border border-slate-300 rounded-md p-4 bg-white min-h-[150px] focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900">
                <EditorJs
                  onInitialize={handleInitialize}
                  placeholder="Cung cấp mô tả chi tiết về mục tiêu của dự án..."
                  tools={tools as any}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-slate-700">Tệp đính kèm dự án</label>
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-md text-sm font-medium flex items-center transition-colors">
                  <Upload className="h-4 w-4 mr-2" />
                  Chọn tệp
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
              onClick={() => router.push('/projects')}
              className="py-2 px-4 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-4 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-medium text-sm flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Đang lưu...' : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Tạo dự án
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
