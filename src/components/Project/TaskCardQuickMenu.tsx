import { useCallback, useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ExternalLink,
  Tag,
  Image as ImageIcon,
  Calendar,
  ArrowRight,
  Archive,
  Search,
  User,
  Link2,
  Copy,
} from 'lucide-react';
import { TaskAppearancePopover } from './TaskAppearancePopover';
import type { TaskCoverMode } from '@/lib/boardBackgroundStyle';
import { CopyTaskCardForm, type CopyTaskBoardTaskRef } from './CopyTaskCardForm';
import type { BoardTask } from './TaskCardFace';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios';

const COLUMN_OPTIONS: { id: string; title: string }[] = [
  { id: 'PENDING', title: 'Chờ xử lý' },
  { id: 'IN_PROGRESS', title: 'Đang thực hiện' },
  { id: 'WAITING_FOR_DOCUMENT', title: 'Chờ tài liệu' },
  { id: 'DELAYED', title: 'Tạm hoãn' },
  { id: 'DONE', title: 'Hoàn thành' },
  { id: 'APPROVED', title: 'Đã duyệt' },
];

export type QuickMenuView = 'actions' | 'cover' | 'labels' | 'dates' | 'move' | 'copy';

type TaskLite = {
  id: string;
  title: string;
  status: string;
  background?: string | null;
  textColor?: string | null;
  coverMode?: TaskCoverMode | null;
  labels?: { id: string; name: string | null; color: string }[];
  startDate?: string | null;
  dueDate?: string | null;
};

type Props = {
  view: QuickMenuView;
  onViewChange: (v: QuickMenuView) => void;
  onClose: () => void;
  task: TaskLite;
  projectId: string;
  projectName: string;
  boardTasks: CopyTaskBoardTaskRef[];
  /** overlay Trello: nền tối + thẻ + menu — style menu dọc */
  layout?: 'default' | 'trello';
  onOpenCard: () => void;
  onAppearance: (data: { background?: string; textColor?: string; coverMode?: TaskCoverMode | null }) => void;
  onLabels: (newLabelIds: string[], updatedLabels: NonNullable<TaskLite['labels']>) => void;
  onMove: (status: string) => void;
  onArchive: () => void;
  onSaveDates: (startDate: string | null, dueDate: string | null) => void;
  copySourceTask: BoardTask;
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

function toLocalDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

type LabelRow = { id: string; name: string | null; color: string };

function QuickLabelList({
  projectId,
  task,
  onLabels,
}: {
  projectId: string;
  task: TaskLite;
  onLabels: (ids: string[], labels: LabelRow[]) => void;
}) {
  const [pool, setPool] = useState<LabelRow[]>([]);
  const [q, setQ] = useState('');
  const selected = task.labels || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(`/projects/${projectId}/labels`);
        if (!cancelled) setPool(res.data || []);
      } catch {
        if (!cancelled) setPool([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = pool.filter((l) => (l.name || '').toLowerCase().includes(q.toLowerCase()));

  const toggle = useCallback(
    (label: LabelRow) => {
      const isSel = selected.some((s) => s.id === label.id);
      const nextLabels = isSel ? selected.filter((s) => s.id !== label.id) : [...selected, label];
      onLabels(
        nextLabels.map((l) => l.id),
        nextLabels
      );
    },
    [selected, onLabels]
  );

  return (
    <div className="p-2">
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm nhãn..."
          className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-sm"
        />
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto custom-scrollbar pr-0.5">
        {filtered.map((label) => {
          const isSelected = selected.some((s) => s.id === label.id);
          return (
            <button
              key={label.id}
              type="button"
              onClick={() => toggle(label)}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-100 px-1 py-0.5 text-left transition hover:bg-slate-50"
            >
              <input type="checkbox" readOnly checked={isSelected} className="h-3.5 w-3.5 rounded" />
              <span
                className="min-h-7 flex-1 rounded-md px-2 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name || ' '}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TaskCardQuickMenu({
  view,
  onViewChange,
  onClose,
  task,
  projectId,
  projectName,
  boardTasks,
  layout = 'default',
  onOpenCard,
  onAppearance,
  onLabels,
  onMove,
  onArchive,
  onSaveDates,
  copySourceTask,
  onOptimisticTaskCopy,
  onCopyTaskConfirm,
  onCopyTaskRollback,
}: Props) {
  const isTrello = layout === 'trello';

  const copyCardLink = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/projects/${projectId}/board?taskId=${encodeURIComponent(task.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Đã sao chép liên kết thẻ');
    } catch {
      toast.error('Không thể sao chép liên kết');
    }
  };
  const [start, setStart] = useState(toLocalDateInput(task.startDate));
  const [due, setDue] = useState(toLocalDateInput(task.dueDate));

  useEffect(() => {
    setStart(toLocalDateInput(task.startDate));
    setDue(toLocalDateInput(task.dueDate));
  }, [task.id, task.startDate, task.dueDate]);

  const header = (title: string) => (
    <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
      <button
        type="button"
        onClick={() => onViewChange('actions')}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        title="Trở lại"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</span>
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

  if (view === 'actions') {
    const itemClass = isTrello
      ? 'flex w-full items-center gap-3 rounded-md border border-slate-200/80 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50'
      : 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100';

    return (
      <div
        className={
          isTrello
            ? 'w-[min(100vw-2rem,18rem)] space-y-1 bg-transparent p-0 shadow-none'
            : 'w-[260px] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1.5 shadow-2xl'
        }
      >
        {!isTrello && (
          <div className="mb-0.5 flex items-center justify-end px-2">
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <nav className={isTrello ? 'space-y-1' : 'px-1.5'}>
          {[
            { k: 'open' as const, icon: ExternalLink, label: 'Mở thẻ', onClick: onOpenCard },
            { k: 'labels' as const, icon: Tag, label: 'Chỉnh sửa nhãn', onClick: () => onViewChange('labels') },
            { k: 'members' as const, icon: User, label: 'Thay đổi thành viên', onClick: onOpenCard },
            { k: 'cover' as const, icon: ImageIcon, label: 'Thay đổi bìa', onClick: () => onViewChange('cover') },
            { k: 'dates' as const, icon: Calendar, label: 'Chỉnh sửa ngày', onClick: () => onViewChange('dates') },
            { k: 'move' as const, icon: ArrowRight, label: 'Di chuyển', onClick: () => onViewChange('move') },
            { k: 'copy' as const, icon: Copy, label: 'Sao chép thẻ', onClick: () => onViewChange('copy') },
            { k: 'link' as const, icon: Link2, label: 'Sao chép liên kết', onClick: () => void copyCardLink() },
            { k: 'arch' as const, icon: Archive, label: 'Lưu trữ', onClick: onArchive },
          ].map(({ k, icon: Icon, label, onClick }) => (
            <button
              key={k}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className={itemClass}
            >
              <Icon className="h-4 w-4 shrink-0 text-slate-500" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  if (view === 'cover') {
    return (
      <div className="w-[min(96vw,22.5rem)] max-h-[min(90vh,580px)] min-h-0 overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <TaskAppearancePopover
          currentBackground={task.background || undefined}
          currentTextColor={task.textColor || undefined}
          currentCoverMode={task.coverMode}
          onBack={() => onViewChange('actions')}
          onClose={onClose}
          projectId={projectId}
          taskId={task.id}
          onUpdate={(d) => onAppearance(d)}
        />
      </div>
    );
  }

  if (view === 'labels') {
    return (
      <div className="w-80 max-h-[min(90vh,480px)] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {header('Nhãn')}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <QuickLabelList projectId={projectId} task={task} onLabels={onLabels} />
        </div>
      </div>
    );
  }

  if (view === 'dates') {
    return (
      <div className="w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {header('Thời gian')}
        <div className="space-y-3 p-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Bắt đầu</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Hạn</label>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onSaveDates(start ? `${start}T00:00:00.000Z` : null, due ? `${due}T23:59:59.000Z` : null);
              toast.success('Đã cập nhật ngày');
            }}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Lưu
          </button>
        </div>
      </div>
    );
  }

  if (view === 'move') {
    return (
      <div className="w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xl">
        {header('Cột đích')}
        <div className="max-h-64 overflow-y-auto px-1.5 custom-scrollbar">
          {COLUMN_OPTIONS.map((col) => (
            <button
              key={col.id}
              type="button"
              disabled={col.id === task.status}
              onClick={() => {
                onMove(col.id);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-default disabled:opacity-40"
            >
              {col.title}
              {col.id === task.status && <span className="text-[10px] text-slate-400">hiện tại</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'copy') {
    return (
      <CopyTaskCardForm
        mode="quick"
        projectId={projectId}
        projectName={projectName}
        sourceTask={copySourceTask}
        sourceTaskId={task.id}
        initialTitle={task.title}
        initialStatus={task.status}
        boardTasks={boardTasks}
        onBack={() => onViewChange('actions')}
        onClose={onClose}
        onOptimisticTaskCopy={onOptimisticTaskCopy}
        onCopyTaskConfirm={onCopyTaskConfirm}
        onCopyTaskRollback={onCopyTaskRollback}
      />
    );
  }

  return null;
}
