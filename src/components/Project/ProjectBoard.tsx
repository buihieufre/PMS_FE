import { useState, useEffect, useRef, memo, useMemo, type CSSProperties } from 'react';
import { Plus, Trash2, LayoutTemplate, MoreHorizontal, Palette, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult, 
  DroppableProvided, 
  DroppableStateSnapshot, 
  DraggableProvided, 
  DraggableStateSnapshot 
} from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/store/authStore';
import type { TaskCoverMode } from '@/lib/boardBackgroundStyle';
import { TaskCardFace, type BoardTask } from './TaskCardFace';
import { TaskCardQuickMenu, type QuickMenuView } from './TaskCardQuickMenu';
import axiosInstance from '@/lib/axios';
export type { BoardTemplateOption } from '@/lib/boardTemplateOption';

type Task = BoardTask;

export type ServerBoardList = {
  id: string;
  name: string;
  sortOrder: number;
  colorClass: string | null;
  mapsToStatus: string;
};

interface ProjectBoardProps {
  projectId: string;
  /** Tên bảng (dự án) — hiển thị khi sao chép thẻ */
  projectName: string;
  tasks: Task[];
  boardLists: ServerBoardList[];
  canManageBoard?: boolean;
  onRefreshBoardLists?: () => void;
  onRefreshBoardTemplates?: () => void;
  /** Lọc theo tiêu đề; kiểm soát từ trang board */
  searchTerm?: string;
  onTaskUpdate: () => void;
  onOptimisticUpdate?: (taskId: string, newStatus: string, boardListId?: string | null) => void;
  onUpdateTaskAppearance?: (taskId: string, data: { background?: string; textColor?: string; coverMode?: TaskCoverMode | null }) => void;
  onOptimisticReorder?: (taskIds: string[], status: string, boardListId: string) => void;
  /** Cập nhật tối ưu (nhãn, ngày, lưu trữ) đồng bộ cùng board.tsx / lastTaskUpdatesRef */
  onOptimisticTaskPatch?: (taskId: string, patch: Record<string, unknown>) => void;
  onOptimisticTaskCopy?: (args: {
    tempId: string;
    title: string;
    status: string;
    boardListId: string | null;
    position: number;
    sourceTask: Task;
  }) => void;
  onCopyTaskConfirm?: (tempId: string, task: Task) => void;
  onCopyTaskRollback?: (tempId: string, message?: string) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (listId: string, mapsToStatus: string) => void;
  /** Đổi màu cột chỉ lưu cho user hiện tại; không truyền = lưu chung (board-list) */
  persistColumnColorPersonal?: (listId: string, colorClass: string) => Promise<void>;
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-50 text-blue-600',
  WAITING_FOR_DOCUMENT: 'bg-amber-50 text-amber-600',
  DELAYED: 'bg-rose-50 text-rose-600',
  DONE: 'bg-emerald-50 text-emerald-600',
  APPROVED: 'bg-indigo-50 text-indigo-600',
  REJECTED: 'bg-red-50 text-red-700',
};

const COLUMN_COLOR_OPTIONS = [
  { value: 'bg-slate-100 text-slate-600', hex: '#64748b' },
  { value: 'bg-blue-50 text-blue-600', hex: '#2563eb' },
  { value: 'bg-amber-50 text-amber-600', hex: '#d97706' },
  { value: 'bg-rose-50 text-rose-600', hex: '#e11d48' },
  { value: 'bg-emerald-50 text-emerald-600', hex: '#059669' },
  { value: 'bg-indigo-50 text-indigo-600', hex: '#4f46e5' },
  { value: 'bg-red-50 text-red-700', hex: '#b91c1c' },
] as const;
const COLOR_HEX_BY_CLASS: Record<string, string> = Object.fromEntries(
  COLUMN_COLOR_OPTIONS.map((opt) => [opt.value, opt.hex])
);

const MAP_STATUS_OPTIONS: { id: string; title: string }[] = [
  { id: 'PENDING', title: 'Chờ xử lý' },
  { id: 'IN_PROGRESS', title: 'Đang thực hiện' },
  { id: 'WAITING_FOR_DOCUMENT', title: 'Chờ tài liệu' },
  { id: 'DELAYED', title: 'Tạm hoãn' },
  { id: 'DONE', title: 'Hoàn thành' },
  { id: 'APPROVED', title: 'Đã duyệt' },
  { id: 'REJECTED', title: 'Từ chối' },
];

const StrictDroppable = ({ children, ...props }: any) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) return null;
  return <Droppable {...props}>{children}</Droppable>;
};

const QUICK_EDIT_SNAP = { isDragging: false, isClone: false } as DraggableStateSnapshot;

const TaskCard = memo(
  ({
    task,
    index,
    onTaskClick,
    handleOpenMenu,
    isQuickEditSource,
  }: {
    task: Task;
    index: number;
    onTaskClick: (task: Task) => void;
    handleOpenMenu: (e: React.MouseEvent, taskId: string) => void;
    isQuickEditSource: boolean;
  }) => {
    return (
      <Draggable key={task.id} draggableId={task.id} index={index}>
        {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
          const { style: dndStyle, ...dndRest } = provided.draggableProps;
          const cardContent = (
            <TaskCardFace
              ref={provided.innerRef}
              task={task}
              snapshot={snapshot}
              onOpenMenu={handleOpenMenu}
              showEditControls
              style={dndStyle as CSSProperties}
              onClick={() => !snapshot.isDragging && onTaskClick(task)}
              className={isQuickEditSource ? 'pointer-events-none opacity-0' : undefined}
              {...dndRest}
              {...provided.dragHandleProps}
            />
          );
          if (snapshot.isDragging) {
            return createPortal(cardContent, document.body);
          }
          return cardContent;
        }}
      </Draggable>
    );
  },
  (prev, next) =>
    prev.task === next.task &&
    prev.index === next.index &&
    prev.isQuickEditSource === next.isQuickEditSource
);

function taskBelongsToList(task: Task, list: ServerBoardList): boolean {
  if (task.boardListId && task.boardListId === list.id) return true;
  if (!task.boardListId && task.status === list.mapsToStatus) return true;
  return false;
}

export default function ProjectBoard({
  projectId,
  projectName,
  tasks,
  boardLists,
  canManageBoard,
  onRefreshBoardLists,
  onRefreshBoardTemplates,
  searchTerm = '',
  onTaskUpdate,
  onOptimisticUpdate,
  onUpdateTaskAppearance,
  onOptimisticReorder,
  onOptimisticTaskPatch,
  onOptimisticTaskCopy,
  onCopyTaskConfirm,
  onCopyTaskRollback,
  onTaskClick,
  onAddTask,
  persistColumnColorPersonal,
}: ProjectBoardProps) {
  const { emit, socket } = useSocket(projectId);
  const { user } = useAuthStore();
  const [displayBoardLists, setDisplayBoardLists] = useState<ServerBoardList[]>(boardLists);
  const [columnNameInputs, setColumnNameInputs] = useState<Record<string, string>>({});
  const [columnOrderInputs, setColumnOrderInputs] = useState<Record<string, string>>({});

  const boardListsForCopy = useMemo(
    () => displayBoardLists.map((l) => ({ id: l.id, name: l.name, mapsToStatus: l.mapsToStatus })),
    [displayBoardLists]
  );
  const boardColumnOptionsMemo = useMemo(
    () => displayBoardLists.map((l) => ({ id: l.id, title: l.name, mapsToStatus: l.mapsToStatus })),
    [displayBoardLists]
  );
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const isDraggingCardRef = useRef(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [quickEditCardRect, setQuickEditCardRect] = useState<DOMRect | null>(null);
  const [quickMenuView, setQuickMenuView] = useState<QuickMenuView>('actions');
  const lastLocalUpdateRef = useRef(0);
  const pendingActionsRef = useRef(0);

  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColStatus, setNewColStatus] = useState<string>('PENDING');
  const [savingList, setSavingList] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);
  const [columnActionLoadingId, setColumnActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setDisplayBoardLists(boardLists);
  }, [boardLists]);

  const submitNewColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || savingList) return;
    setSavingList(true);
    try {
      await axiosInstance.post(`/projects/${projectId}/board-lists`, {
        name: newColName.trim(),
        mapsToStatus: newColStatus,
      });
      toast.success('Đã thêm cột');
      setNewColName('');
      setShowAddColumn(false);
      onRefreshBoardLists?.();
    } catch {
      toast.error('Không thể thêm cột');
    } finally {
      setSavingList(false);
    }
  };

  const deleteColumn = async (listId: string) => {
    if (!confirm('Xóa cột này? Thẻ sẽ được gộp sang cột cùng trạng thái (nếu có).')) return;
    try {
      await axiosInstance.delete(`/projects/${projectId}/board-lists/${listId}`);
      toast.success('Đã xóa cột');
      onRefreshBoardLists?.();
      onTaskUpdate();
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' &&
        err &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg || 'Không thể xóa cột');
    }
  };

  const refreshLocalBoardLists = async () => {
    onRefreshBoardLists?.();
  };

  const patchColumn = async (listId: string, payload: Record<string, unknown>) => {
    setColumnActionLoadingId(listId);
    try {
      await axiosInstance.patch(`/projects/${projectId}/board-lists/${listId}`, payload);
      await refreshLocalBoardLists();
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' &&
        err &&
        'response' in err &&
        (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message;
      toast.error(msg || 'Không thể cập nhật cột');
    } finally {
      setColumnActionLoadingId(null);
    }
  };

  const changeColumnColorOptimistic = async (listId: string, colorClass: string) => {
    const previousLists = displayBoardLists;
    setDisplayBoardLists((prev) =>
      prev.map((list) => (list.id === listId ? { ...list, colorClass } : list))
    );
    setColumnActionLoadingId(listId);
    try {
      if (persistColumnColorPersonal) {
        await persistColumnColorPersonal(listId, colorClass);
      } else {
        await axiosInstance.patch(`/projects/${projectId}/board-lists/${listId}`, { colorClass });
        await refreshLocalBoardLists();
      }
    } catch (err: unknown) {
      setDisplayBoardLists(previousLists);
      const msg =
        typeof err === 'object' &&
        err &&
        'response' in err &&
        (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message;
      toast.error(msg || 'Không thể cập nhật màu cột');
    } finally {
      setColumnActionLoadingId(null);
    }
  };

  const submitColumnUpdate = async (list: ServerBoardList) => {
    const previousLists = displayBoardLists;
    const fallbackOrder = displayBoardLists.findIndex((l) => l.id === list.id) + 1;
    const orderRaw = Number(columnOrderInputs[list.id] ?? fallbackOrder);
    const oneBasedOrder = Number.isFinite(orderRaw)
      ? Math.max(1, Math.min(displayBoardLists.length, orderRaw))
      : fallbackOrder;
    const nextName = (columnNameInputs[list.id] ?? list.name).trim() || list.name;
    const targetIndex = oneBasedOrder - 1;

    // Optimistic: đổi tên + vị trí cột ngay trên UI trước
    const nextLists = [...displayBoardLists];
    const fromIndex = nextLists.findIndex((l) => l.id === list.id);
    if (fromIndex < 0) return;
    const [moving] = nextLists.splice(fromIndex, 1);
    const moved = { ...moving, name: nextName };
    nextLists.splice(targetIndex, 0, moved);
    const normalized = nextLists.map((row, idx) => ({ ...row, sortOrder: idx }));
    setDisplayBoardLists(normalized);
    setOpenColumnMenuId(null);

    setColumnActionLoadingId(list.id);
    try {
      await axiosInstance.patch(`/projects/${projectId}/board-lists/${list.id}`, {
        name: nextName,
        sortOrder: targetIndex,
      });
      await refreshLocalBoardLists();
    } catch (err: unknown) {
      // rollback nếu BE fail
      setDisplayBoardLists(previousLists);
      const msg =
        typeof err === 'object' &&
        err &&
        'response' in err &&
        (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message;
      toast.error(msg || 'Không thể cập nhật cột');
    } finally {
      setColumnActionLoadingId(null);
    }
  };

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || templateSaving) return;
    setTemplateSaving(true);
    try {
      await axiosInstance.post(`/projects/${projectId}/board-templates`, { name: templateName.trim() });
      toast.success('Đã lưu template');
      setTemplateName('');
      setShowSaveTemplate(false);
      onRefreshBoardTemplates?.();
    } catch {
      toast.error('Không lưu được template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleOpenMenu = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const cardEl = (e.currentTarget as HTMLElement).closest('[data-task-card-wrap]') as HTMLElement | null;
    const rect = cardEl?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 10;
    const menuW = 280;
    let left = rect.right + GAP;
    if (left + menuW > window.innerWidth - 8) {
      left = Math.max(8, rect.left - menuW - GAP);
    }
    const estMenuH = 520;
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - estMenuH - 8));
    setQuickEditCardRect(rect);
    setMenuPosition({ top, left });
    setQuickMenuView('actions');
    setActiveMenuId(taskId);
  };

  const closeMenu = () => {
    setActiveMenuId(null);
    setMenuPosition(null);
    setQuickEditCardRect(null);
  };

  useEffect(() => {
    if (!activeMenuId) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setActiveMenuId(null);
        setMenuPosition(null);
        setQuickEditCardRect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeMenuId]);

  const emitTaskUpdate = (taskId: string, updates: Record<string, unknown>) => {
    if (!socket?.id) return;
    const now = Date.now();
    emit('task:update', {
      taskId,
      projectId,
      userId: user?.id,
      updates,
      updatedAt: now,
      senderId: socket.id
    });
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const quickMenuTask = activeMenuId ? localTasks.find((t) => t.id === activeMenuId) : undefined;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const target = e.target as HTMLElement;
    if (
      ['BUTTON', 'INPUT', 'TEXTAREA', 'A'].includes(target.tagName) || 
      target.closest('button') || 
      target.closest('[data-rbd-draggable-id]') ||
      target.closest('.group')
    ) return;
    
    e.preventDefault();
    setIsMouseDown(true);
    scrollRef.current.classList.add('cursor-grabbing');
    scrollRef.current.classList.remove('cursor-grab');
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsMouseDown(false);
  const handleMouseUp = () => setIsMouseDown(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCardRef.current) return;
    if (!isMouseDown || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    if (pendingActionsRef.current > 0) return;
    setLocalTasks(tasks);
  }, [tasks]);

  const onDragStart = () => {
    isDraggingCardRef.current = true;
    setIsDraggingCard(true);
  };

  const onDragEnd = (result: DropResult) => {
    isDraggingCardRef.current = false;
    setIsDraggingCard(false);
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const destList = displayBoardLists.find((l) => l.id === destination.droppableId);
    if (!destList) return;

    const destStatus = destList.mapsToStatus;
    const movingTask = localTasks.find(t => t.id === draggableId);
    if (!movingTask) return;

    lastLocalUpdateRef.current = Date.now();
    const w = localTasks.filter(t => t.id !== draggableId);
    const destCol = w.filter((t) => taskBelongsToList(t, destList));
    destCol.splice(destination.index, 0, { ...movingTask, status: destStatus, boardListId: destList.id });
    const outsideDest = w.filter((t) => !taskBelongsToList(t, destList));
    setLocalTasks([...outsideDest, ...destCol]);

    const ids = destCol.map(t => t.id);
    if (onOptimisticReorder) onOptimisticReorder(ids, destStatus, destList.id);

    pendingActionsRef.current += 1;
    emit('task:reorder', { projectId, taskIds: ids, status: destStatus, boardListId: destList.id }, (response: any) => {
      pendingActionsRef.current = Math.max(0, pendingActionsRef.current - 1);
      if (response.status === 'error') {
        toast.error(response.message || 'Failed to move task');
        onTaskUpdate();
      }
    });
  };

  /** Kéo thẻ áp mép trái/phải vùng bảng → tự cuộn ngang (theo con trỏ / touch). */
  useEffect(() => {
    if (!isDraggingCard) return;

    const pointer = { x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0 };
    let rafId = 0;
    let stopped = false;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if ('clientX' in e && typeof (e as MouseEvent).clientX === 'number') {
        pointer.x = (e as MouseEvent).clientX;
      } else if ('touches' in e && (e as TouchEvent).touches[0]) {
        pointer.x = (e as TouchEvent).touches[0].clientX;
      }
    };

    const EDGE_PX = 80;

    const tick = () => {
      if (stopped || !isDraggingCardRef.current) return;
      const el = scrollRef.current;
      if (!el) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const rect = el.getBoundingClientRect();
      const mx = pointer.x;
      let delta = 0;

      if (mx <= rect.left + EDGE_PX) {
        const depth = Math.min(1.8, (rect.left + EDGE_PX - mx) / EDGE_PX);
        delta = -Math.min(56, 5 + depth * 44);
      } else if (mx >= rect.right - EDGE_PX) {
        const depth = Math.min(1.8, (mx - (rect.right - EDGE_PX)) / EDGE_PX);
        delta = Math.min(56, 5 + depth * 44);
      }

      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (delta !== 0 && maxScroll > 0) {
        el.scrollLeft = Math.max(0, Math.min(maxScroll, el.scrollLeft + delta));
      }

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
    };
  }, [isDraggingCard]);

  const filteredTasks = localTasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-transparent">
        <div 
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="board-scrollbar-x flex h-full min-h-0 min-w-0 flex-1 basis-0 items-stretch gap-6 overflow-x-auto overflow-y-hidden px-6 pb-2 pt-0 custom-scrollbar cursor-grab"
        >
          <div className="w-10 shrink-0" />

          {displayBoardLists.map((col) => {
            const colorClass =
              col.colorClass || DEFAULT_STATUS_COLORS[col.mapsToStatus] || 'bg-slate-100 text-slate-600';
            const accentColor = COLOR_HEX_BY_CLASS[colorClass] || '#94a3b8';
            const currentOrder = displayBoardLists.findIndex((l) => l.id === col.id) + 1;
            const editedName = (columnNameInputs[col.id] ?? col.name).trim();
            const editedOrderRaw = Number(columnOrderInputs[col.id] ?? String(currentOrder));
            const editedOrder = Number.isFinite(editedOrderRaw)
              ? Math.max(1, Math.min(displayBoardLists.length, editedOrderRaw))
              : currentOrder;
            const hasColumnChanges = editedName !== col.name || editedOrder !== currentOrder;
            const columnTasks = filteredTasks.filter((t) => taskBelongsToList(t, col));
            return (
              <div
                key={col.id}
                className="flex h-full max-h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 border-t-4 bg-white/88 shadow-md backdrop-blur-md"
                style={{ borderTopColor: accentColor }}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200/90 bg-slate-50/95 p-4">
                  <div className="flex min-w-0 flex-1 items-center space-x-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${colorClass}`}>
                      {columnTasks.length}
                    </span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
                    <h3 className="truncate text-sm font-bold text-slate-800">{col.name}</h3>
                  </div>
                  {canManageBoard ? (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        title="Tùy chọn cột"
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => {
                          const currentOrder = displayBoardLists.findIndex((l) => l.id === col.id) + 1;
                          setColumnNameInputs((prev) => ({ ...prev, [col.id]: prev[col.id] ?? col.name }));
                          setColumnOrderInputs((prev) => ({ ...prev, [col.id]: prev[col.id] ?? String(currentOrder) }));
                          setOpenColumnMenuId((prev) => (prev === col.id ? null : col.id));
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openColumnMenuId === col.id ? (
                        <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                          <div className="space-y-2 px-1 pb-1">
                            <input
                              type="text"
                              value={columnNameInputs[col.id] ?? col.name}
                              onChange={(e) => setColumnNameInputs((prev) => ({ ...prev, [col.id]: e.target.value }))}
                              placeholder="Tên cột"
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400"
                            />
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 min-w-fit">
                                Chuyển thứ tự
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={displayBoardLists.length}
                                value={columnOrderInputs[col.id] ?? String(displayBoardLists.findIndex((l) => l.id === col.id) + 1)}
                                onChange={(e) => setColumnOrderInputs((prev) => ({ ...prev, [col.id]: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400"
                              />
                            </div>
                            {hasColumnChanges ? (
                              <button
                                type="button"
                                disabled={columnActionLoadingId === col.id}
                                onClick={async () => submitColumnUpdate(col)}
                                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                title="Lưu cập nhật cột"
                              >
                                <Save className="h-3.5 w-3.5" />
                                Lưu thay đổi
                              </button>
                            ) : null}
                          </div>
                          <div className="my-2 h-px bg-slate-100" />
                          <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5" />
                            Đổi màu cột
                          </div>
                          <div className="grid grid-cols-7 gap-1 px-1">
                            {COLUMN_COLOR_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={columnActionLoadingId === col.id}
                                onClick={async () => {
                                  await changeColumnColorOptimistic(col.id, opt.value);
                                }}
                                className={`h-6 w-6 rounded-full border transition ${
                                  col.colorClass === opt.value ? 'ring-2 ring-slate-300' : ''
                                }`}
                                style={{ backgroundColor: opt.hex, borderColor: col.colorClass === opt.value ? '#334155' : '#cbd5e1' }}
                                title="Đổi màu cột"
                              >
                                <span className="sr-only">màu</span>
                              </button>
                            ))}
                          </div>
                          <div className="my-2 h-px bg-slate-100" />
                          <button
                            type="button"
                            disabled={columnActionLoadingId === col.id || displayBoardLists.length <= 1}
                            onClick={async () => {
                              setOpenColumnMenuId(null);
                              await deleteColumn(col.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Xóa cột
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <StrictDroppable droppableId={col.id}>
                  {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`board-scrollbar-y min-h-0 min-w-0 flex-1 shrink overflow-y-auto overflow-x-hidden overscroll-y-contain p-3 space-y-3 pr-2 custom-scrollbar transition-colors ${
                        snapshot.isDraggingOver ? 'bg-emerald-50/50' : 'bg-slate-50/40'
                      }`}
                    >
                      {columnTasks.map((task, index) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          index={index}
                          onTaskClick={onTaskClick}
                          handleOpenMenu={handleOpenMenu}
                          isQuickEditSource={activeMenuId === task.id}
                        />
                      ))}
                      {provided.placeholder}

                      {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-300/70 bg-white/30 text-[10px] font-medium italic text-slate-500">
                          Không có công việc nào
                        </div>
                      )}
                    </div>
                  )}
                </StrictDroppable>

                {canManageBoard ? (
                  <button
                    type="button"
                    onClick={() => onAddTask(col.id, col.mapsToStatus)}
                    className="m-3 flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent p-2 text-[11px] font-bold text-slate-600 transition-all hover:border-emerald-100 hover:bg-emerald-50/90 hover:text-emerald-700"
                  >
                    <Plus className="h-3 w-3" />
                    Thêm thẻ
                  </button>
                ) : null}
              </div>
            );
          })}

          {canManageBoard ? (
            <div className="flex h-full max-h-full min-h-0 w-72 shrink-0 flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-2xl border border-dashed border-slate-300/80 bg-white/50 p-4 shadow-sm backdrop-blur-md">
              {!showAddColumn ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveTemplate(false);
                    setShowAddColumn(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 py-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Plus className="h-4 w-4" />
                  Thêm cột
                </button>
              ) : (
                <form onSubmit={submitNewColumn} className="space-y-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cột mới</p>
                  <input
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="Tên cột"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    required
                  />
                  <select
                    value={newColStatus}
                    onChange={(e) => setNewColStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  >
                    {MAP_STATUS_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title} ({o.id})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingList}
                      className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {savingList ? '…' : 'Tạo cột'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddColumn(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}

              {!showSaveTemplate ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddColumn(false);
                    setShowSaveTemplate(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 py-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800"
                >
                  <LayoutTemplate className="h-4 w-4" />
                  Lưu template bảng
                </button>
              ) : (
                <form onSubmit={saveTemplate} className="space-y-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Template từ bảng này</p>
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Tên template (dùng khi tạo dự án)"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    required
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={templateSaving}
                      className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {templateSaving ? '…' : 'Lưu'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSaveTemplate(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
          <div className="w-10 shrink-0" />
        </div>
      </div>
      
      {activeMenuId && quickEditCardRect && menuPosition && quickMenuTask && createPortal(
        <div className="fixed inset-0 z-[10000]">
          <div className="absolute inset-0 bg-slate-900/55" onClick={closeMenu} aria-hidden />
          <TaskCardFace
            task={quickMenuTask}
            snapshot={QUICK_EDIT_SNAP}
            onOpenMenu={() => {}}
            showEditControls={false}
            className="pointer-events-auto !cursor-default !shadow-2xl !ring-2 !ring-white/90"
            style={{
              position: 'fixed',
              top: quickEditCardRect.top,
              left: quickEditCardRect.left,
              width: quickEditCardRect.width,
              minHeight: quickEditCardRect.height,
              zIndex: 10001,
            }}
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
              onTaskClick(quickMenuTask);
            }}
          />
          <div
            className="pointer-events-auto fixed z-[10002]"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <TaskCardQuickMenu
              layout="trello"
              view={quickMenuView}
              onViewChange={setQuickMenuView}
              onClose={closeMenu}
              task={{
                id: quickMenuTask.id,
                title: quickMenuTask.title,
                status: quickMenuTask.status,
                boardListId: quickMenuTask.boardListId,
                background: quickMenuTask.background,
                textColor: quickMenuTask.textColor,
                coverMode: quickMenuTask.coverMode,
                labels: quickMenuTask.labels,
                startDate: quickMenuTask.startDate,
                dueDate: quickMenuTask.dueDate
              }}
              projectId={projectId}
              projectName={projectName}
              boardColumnOptions={boardColumnOptionsMemo}
              boardTasks={localTasks.map((t) => ({
                id: t.id,
                status: t.status,
                boardListId: t.boardListId,
              }))}
              onOpenCard={() => {
                closeMenu();
                onTaskClick(quickMenuTask);
              }}
              onAppearance={(data) => {
                onUpdateTaskAppearance?.(activeMenuId, data);
              }}
              onLabels={(ids, updated) => {
                onOptimisticTaskPatch?.(activeMenuId, { labels: updated, labelIds: ids } as any);
                emitTaskUpdate(activeMenuId, { labelIds: ids });
              }}
              onSaveDates={(start, due) => {
                onOptimisticTaskPatch?.(activeMenuId, { startDate: start, dueDate: due } as any);
                emitTaskUpdate(activeMenuId, { startDate: start, dueDate: due });
                closeMenu();
              }}
              onMove={(listId) => {
                const list = displayBoardLists.find((l) => l.id === listId);
                const st = list?.mapsToStatus ?? 'PENDING';
                onOptimisticUpdate?.(activeMenuId, st, list?.id ?? null);
                emit(
                  'task:move',
                  {
                    taskId: activeMenuId,
                    projectId,
                    status: st,
                    boardListId: list?.id ?? null,
                    userId: user?.id,
                  },
                  (res: { status?: string; message?: string }) => {
                    if (res?.status === 'error') {
                      toast.error(res?.message || 'Không thể di chuyển thẻ');
                      onTaskUpdate();
                    }
                  }
                );
                closeMenu();
              }}
              onArchive={() => {
                onOptimisticTaskPatch?.(activeMenuId, { archived: true } as any);
                emitTaskUpdate(activeMenuId, { archived: true });
                closeMenu();
              }}
              copySourceTask={quickMenuTask}
              boardListsForCopy={boardListsForCopy}
              onOptimisticTaskCopy={onOptimisticTaskCopy}
              onCopyTaskConfirm={onCopyTaskConfirm}
              onCopyTaskRollback={onCopyTaskRollback}
              canDuplicateCard={!!canManageBoard}
            />
          </div>
        </div>,
        document.body
      )}
    </DragDropContext>
  );
}
