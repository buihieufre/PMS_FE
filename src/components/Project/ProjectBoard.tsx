import { useState, useEffect, useRef, memo, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
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

type Task = BoardTask;

interface ProjectBoardProps {
  projectId: string;
  tasks: Task[];
  /** Lọc theo tiêu đề; kiểm soát từ trang board */
  searchTerm?: string;
  onTaskUpdate: () => void;
  onOptimisticUpdate?: (taskId: string, newStatus: string) => void;
  onUpdateTaskAppearance?: (taskId: string, data: { background?: string; textColor?: string; coverMode?: TaskCoverMode | null }) => void;
  onOptimisticReorder?: (taskIds: string[], status: string) => void;
  /** Cập nhật tối ưu (nhãn, ngày, lưu trữ) đồng bộ cùng board.tsx / lastTaskUpdatesRef */
  onOptimisticTaskPatch?: (taskId: string, patch: Record<string, unknown>) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
}

const COLUMNS = [
  { id: 'PENDING', title: 'Chờ xử lý', color: 'bg-slate-100 text-slate-600' },
  { id: 'IN_PROGRESS', title: 'Đang thực hiện', color: 'bg-blue-50 text-blue-600' },
  { id: 'WAITING_FOR_DOCUMENT', title: 'Chờ tài liệu', color: 'bg-amber-50 text-amber-600' },
  { id: 'DELAYED', title: 'Tạm hoãn', color: 'bg-rose-50 text-rose-600' },
  { id: 'DONE', title: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-600' },
  { id: 'APPROVED', title: 'Đã duyệt', color: 'bg-indigo-50 text-indigo-600' },
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

export default function ProjectBoard({ projectId, tasks, searchTerm = '', onTaskUpdate, onOptimisticUpdate, onUpdateTaskAppearance, onOptimisticReorder, onOptimisticTaskPatch, onTaskClick, onAddTask }: ProjectBoardProps) {
  const { emit, socket } = useSocket(projectId);
  const { user } = useAuthStore();
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [quickEditCardRect, setQuickEditCardRect] = useState<DOMRect | null>(null);
  const [quickMenuView, setQuickMenuView] = useState<QuickMenuView>('actions');
  const lastLocalUpdateRef = useRef(0);
  const pendingActionsRef = useRef(0);

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
    
    setIsMouseDown(true);
    scrollRef.current.classList.add('cursor-grabbing');
    scrollRef.current.classList.remove('cursor-grab');
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsMouseDown(false);
  const handleMouseUp = () => setIsMouseDown(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    if (pendingActionsRef.current > 0) return;
    setLocalTasks(tasks);
  }, [tasks]);

  const onDragStart = () => setIsDraggingCard(true);

  const onDragEnd = (result: DropResult) => {
    setIsDraggingCard(false);
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const destStatus = destination.droppableId;
    const movingTask = localTasks.find(t => t.id === draggableId);
    if (!movingTask) return;

    lastLocalUpdateRef.current = Date.now();
    const filtered = localTasks.filter(t => t.id !== draggableId);
    const destInFiltered = filtered.filter(t => t.status === destStatus);
    destInFiltered.splice(destination.index, 0, { ...movingTask, status: destStatus });
    
    setLocalTasks(prev => {
      const otherStatusTasks = prev.filter(t => t.id !== draggableId && t.status !== destStatus);
      return [...otherStatusTasks, ...destInFiltered];
    });

    const ids = destInFiltered.map(t => t.id);
    if (onOptimisticReorder) onOptimisticReorder(ids, destStatus);

    pendingActionsRef.current += 1;
    emit('task:reorder', { projectId, taskIds: ids, status: destStatus }, (response: any) => {
      pendingActionsRef.current = Math.max(0, pendingActionsRef.current - 1);
      if (response.status === 'error') {
        toast.error(response.message || 'Failed to move task');
        onTaskUpdate();
      }
    });
  };

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

          {COLUMNS.map((col) => {
            const columnTasks = filteredTasks.filter(t => t.status === col.id);
            return (
              <div 
                key={col.id} 
                className="flex h-full max-h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/88 shadow-md backdrop-blur-md"
              >
                <div className="shrink-0 p-4 flex items-center justify-between border-b border-slate-200/90 bg-slate-50/95">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${col.color}`}>
                      {columnTasks.length}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 truncate">
                      {col.title}
                    </h3>
                  </div>
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
                         <div className="h-24 border-2 border-dashed border-slate-300/70 rounded-xl flex items-center justify-center text-[10px] font-medium text-slate-500 italic bg-white/30">
                            Không có công việc nào
                         </div>
                      )}
                    </div>
                  )}
                </StrictDroppable>

                <button 
                  onClick={() => onAddTask(col.id)}
                  className="m-3 shrink-0 p-2 flex items-center justify-center gap-2 text-[11px] font-bold rounded-lg transition-all text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/90 border border-transparent hover:border-emerald-100"
                >
                  <Plus className="h-3 w-3" />
                  Thêm thẻ
                </button>
              </div>
            );
          })}
          
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
                status: quickMenuTask.status,
                background: quickMenuTask.background,
                textColor: quickMenuTask.textColor,
                coverMode: quickMenuTask.coverMode,
                labels: quickMenuTask.labels,
                startDate: quickMenuTask.startDate,
                dueDate: quickMenuTask.dueDate
              }}
              projectId={projectId}
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
              onMove={(status) => {
                onOptimisticUpdate?.(activeMenuId, status);
                emit(
                  'task:move',
                  { taskId: activeMenuId, projectId, status, userId: user?.id },
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
            />
          </div>
        </div>,
        document.body
      )}
    </DragDropContext>
  );
}
