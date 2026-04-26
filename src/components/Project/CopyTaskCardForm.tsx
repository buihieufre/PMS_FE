import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios';
import type { BoardTask } from './TaskCardFace';

export const COPY_TASK_COLUMN_OPTIONS: { id: string; title: string }[] = [
  { id: 'PENDING', title: 'Chờ xử lý' },
  { id: 'IN_PROGRESS', title: 'Đang thực hiện' },
  { id: 'WAITING_FOR_DOCUMENT', title: 'Chờ tài liệu' },
  { id: 'DELAYED', title: 'Tạm hoãn' },
  { id: 'DONE', title: 'Hoàn thành' },
  { id: 'APPROVED', title: 'Đã duyệt' },
];

export type CopyTaskBoardTaskRef = { id: string; status: string };

type Props = {
  projectId: string;
  projectName: string;
  sourceTask: BoardTask;
  sourceTaskId: string;
  initialTitle: string;
  initialStatus: string;
  boardTasks: CopyTaskBoardTaskRef[];
  mode: 'quick' | 'modal';
  onBack?: () => void;
  onClose: () => void;
  onOptimisticTaskCopy?: (args: {
    tempId: string;
    title: string;
    status: string;
    position: number;
    sourceTask: BoardTask;
  }) => void;
  onCopyTaskConfirm?: (tempId: string, task: BoardTask) => void;
  onCopyTaskRollback?: (tempId: string, message?: string) => void;
};

export function CopyTaskCardForm({
  projectId,
  projectName,
  sourceTask,
  sourceTaskId,
  initialTitle,
  initialStatus,
  boardTasks,
  mode,
  onBack,
  onClose,
  onOptimisticTaskCopy,
  onCopyTaskConfirm,
  onCopyTaskRollback,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [position, setPosition] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    setTitle(initialTitle);
    setStatus(
      COPY_TASK_COLUMN_OPTIONS.some((c) => c.id === initialStatus) ? initialStatus : 'PENDING'
    );
  }, [initialTitle, initialStatus, sourceTaskId]);

  const countInColumn = useMemo(
    () => boardTasks.filter((t) => t.status === status).length,
    [boardTasks, status]
  );

  const maxPosition = countInColumn + 1;

  useEffect(() => {
    setPosition(maxPosition);
  }, [status, maxPosition, sourceTaskId]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error('Tên thẻ là bắt buộc');
      return;
    }
    if (!onOptimisticTaskCopy || !onCopyTaskConfirm || !onCopyTaskRollback) {
      toast.error('Thiếu xử lý sao chép trên bảng');
      return;
    }
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);

    const tempId = `temp-copy-${crypto.randomUUID()}`;
    onOptimisticTaskCopy({
      tempId,
      title: trimmed,
      status,
      position,
      sourceTask,
    });
    toast.success('Đã tạo bản sao thẻ');
    onClose();
    submitLock.current = false;
    setSubmitting(false);

    const postCopy = (force: boolean) =>
      axiosInstance.post(`/projects/${projectId}/tasks/${sourceTaskId}/copy${force ? '?force=true' : ''}`, {
        title: trimmed,
        status,
        position,
      });

    void (async () => {
      try {
        const res = await postCopy(false);
        onCopyTaskConfirm(tempId, res.data.task);
      } catch (err: any) {
        if (err.response?.data?.error === 'WORKLOAD_WARNING') {
          try {
            const res2 = await postCopy(true);
            onCopyTaskConfirm(tempId, res2.data.task);
          } catch (e2: any) {
            onCopyTaskRollback(
              tempId,
              e2.response?.data?.message || e2.response?.data?.error || 'Sao chép thẻ thất bại'
            );
          }
        } else {
          onCopyTaskRollback(
            tempId,
            err.response?.data?.message || err.response?.data?.error || 'Sao chép thẻ thất bại'
          );
        }
      }
    })();
  };

  const headerQuick = (
    <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        title="Trở lại"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs font-black uppercase tracking-wide text-slate-700">Sao chép thẻ</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Đóng"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  const headerModal = (
    <div className="border-b border-slate-200 px-4 py-3">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          title="Đóng"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="flex-1 text-center text-sm font-black text-slate-800">Sao chép thẻ</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-4 border-b border-transparent px-1 text-xs font-bold text-slate-400">
        <span className="border-b-2 border-indigo-600 pb-2 text-indigo-600">Thông tin</span>
      </div>
    </div>
  );

  const fieldClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
  const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500';

  const body = (
    <div className={mode === 'modal' ? 'p-4 space-y-4' : 'space-y-4 p-3'}>
      <div>
        <label className={labelClass}>Tên</label>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={3}
          className={`${fieldClass} min-h-[5rem] resize-y`}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold text-slate-600">Sao chép tới...</p>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Bảng thông tin</label>
            <select disabled className={`${fieldClass} cursor-not-allowed bg-slate-50 text-slate-600`}>
              <option>{projectName}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-[2]">
              <label className={labelClass}>Danh sách</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
                {COPY_TASK_COLUMN_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <label className={labelClass}>Vị trí</label>
              <select
                value={String(position)}
                onChange={(e) => setPosition(parseInt(e.target.value, 10))}
                className={fieldClass}
              >
                {Array.from({ length: maxPosition }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={() => submit()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Tạo thẻ
      </button>
    </div>
  );

  if (mode === 'quick') {
    return (
      <div className="w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {headerQuick}
        {body}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      {headerModal}
      {body}
    </div>
  );
}
