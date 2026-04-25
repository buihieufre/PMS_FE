import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, Maximize2 } from 'lucide-react';
import { getEditorTools } from '@/lib/editorTools';
import { parseTaskDescriptionData } from '@/lib/taskDescription';

const EditorJs = dynamic(
  () => import('react-editor-js').then((mod) => mod.createReactEditorJS()),
  { ssr: false }
);

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Chuỗi lưu DB: JSON OutputData hoặc text cũ */
  value: string;
  onApply: (json: string) => void;
  title?: string;
  /** Cao hơn modal tạo thẻ (z-50) / chi tiết thẻ (z-50) */
  zIndexClass?: string;
};

export default function DescriptionEditorExpandModal({
  isOpen,
  onClose,
  value,
  onApply,
  title = 'Soạn mô tả công việc',
  zIndexClass = 'z-[200]',
}: Props) {
  const [sessionKey, setSessionKey] = useState(0);
  const editorRef = useRef<any>(null);
  const tools = useMemo(() => getEditorTools(), []);
  const defaultData = useMemo(
    () => parseTaskDescriptionData(value),
    // Khi mở modal (sessionKey đổi) lấy value hiện tại — không theo từng lần gõ bên ngoài khi đang mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionKey]
  );
  const handleInit = useCallback((core: any) => {
    editorRef.current = core;
  }, []);

  const prevOpen = useRef(false);
  useLayoutEffect(() => {
    if (isOpen && !prevOpen.current) {
      setSessionKey((k) => k + 1);
    }
    prevOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleApply = useCallback(async () => {
    if (!editorRef.current) {
      onClose();
      return;
    }
    try {
      const saved = await editorRef.current.save();
      onApply(JSON.stringify(saved));
    } catch {
      onClose();
    }
  }, [onApply, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex flex-col bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200`}
      role="dialog"
      aria-modal
      aria-labelledby="description-expand-title"
    >
      <div className="mx-auto my-3 flex w-full max-w-5xl flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl sm:my-5">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Maximize2 className="h-4 w-4" aria-hidden />
            </div>
            <h2
              id="description-expand-title"
              className="text-sm font-black uppercase tracking-tight text-slate-800 truncate"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            title="Đóng (Esc)"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <p className="shrink-0 border-b border-slate-100 px-4 py-2 text-xs text-slate-500 sm:px-6">
          Dùng thanh công cụ block để tiêu đề, danh sách, bảng, trích dẫn, code… Cố gắng trình bày gọn, dễ theo dõi.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="prose prose-slate max-w-none px-4 py-4 sm:px-6 sm:py-5 min-h-[50vh]">
            <EditorJs
              key={sessionKey}
              onInitialize={handleInit}
              defaultValue={defaultData}
              placeholder="Bắt đầu soạn mô tả…"
              tools={tools as any}
            />
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200/80"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-200/40 transition hover:bg-indigo-700 active:scale-[0.99]"
          >
            Áp dụng
          </button>
        </footer>
      </div>
    </div>
  );
}
