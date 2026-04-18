import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { MoreVertical, Plus, Users, Calendar, MessageSquare, Paperclip, CheckSquare, Clock, AlignLeft } from 'lucide-react';
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
import { TaskAppearancePopover } from './TaskAppearancePopover';
import { useAuthStore } from '@/store/authStore';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  dueDate?: string;
  background?: string | null;
  textColor?: string | null;
  assignees?: { id: string; displayName: string; avatarUrl?: string }[];
  labels?: { id: string; name: string; color: string }[];
  checklists?: any[];
  activities?: any[];
  attachments?: any[];
}

interface ProjectBoardProps {
  projectId: string;
  tasks: Task[];
  boardBackground?: string | null;
  onTaskUpdate: () => void;
  onOptimisticUpdate?: (taskId: string, newStatus: string) => void;
  onUpdateTaskAppearance?: (taskId: string, data: { background?: string, textColor?: string }) => void;
  onOptimisticReorder?: (taskIds: string[], status: string) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
}

const COLUMNS = [
  { id: 'PENDING', title: 'Pending', color: 'bg-slate-100 text-slate-600' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-50 text-blue-600' },
  { id: 'WAITING_FOR_DOCUMENT', title: 'Waiting', color: 'bg-amber-50 text-amber-600' },
  { id: 'DELAYED', title: 'Delayed', color: 'bg-rose-50 text-rose-600' },
  { id: 'DONE', title: 'Completed', color: 'bg-emerald-50 text-emerald-600' },
  { id: 'APPROVED', title: 'Approved', color: 'bg-indigo-50 text-indigo-600' },
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

const TaskCard = memo(({ task, index, boardBackground, onTaskClick, handleOpenMenu }: { 
  task: Task; 
  index: number;
  boardBackground?: string | null; 
  onTaskClick: (task: Task) => void; 
  handleOpenMenu: (e: React.MouseEvent, taskId: string) => void;
}) => {
  return (
    <Draggable key={task.id} draggableId={task.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
        const style = {
          ...provided.draggableProps.style,
          background: task.background
            ? task.background.startsWith('linear-gradient') || task.background.startsWith('#') || task.background.startsWith('rgb')
              ? task.background
              : `url(${task.background}) center/cover no-repeat`
            : 'white',
          color: task.textColor || 'inherit',
          borderColor: snapshot.isDragging ? 'rgba(255,255,255,0.6)' : task.background ? 'transparent' : '#e2e8f0',
        };

        const cardContent = (
          <div 
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => !snapshot.isDragging && onTaskClick(task)}
            className={`group p-4 rounded-xl shadow-sm border relative ${
              snapshot.isDragging 
                ? 'shadow-2xl rotate-3 scale-105 z-[9999] ring-2 ring-white/50 cursor-grabbing' 
                : 'hover:shadow-md transition-all cursor-grab'
            }`}
            style={style}
          >
            {/* Card Menu (Triple Dots) */}
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => handleOpenMenu(e, task.id)}
                className="p-1 rounded-lg hover:bg-black/10 text-slate-400 hover:text-slate-600 outline-none transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            {task.labels && task.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {task.labels.map(label => (
                  <div key={label.id} className="h-2 w-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundColor: label.color }} title={label.name || ''} />
                ))}
              </div>
            )}
            <h4
              className="text-sm font-bold mb-2 group-hover:opacity-80 transition-colors"
              style={{ color: task.textColor || '#1e293b' }}
            >
              {task.title}
            </h4>
            
            {/* Task Meta Stats */}
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-50">
              {task.dueDate && (
                <div className="flex items-center px-2 py-1 bg-amber-400 text-slate-900 rounded-md text-[10px] font-bold shadow-sm">
                  <Clock className="h-3 w-3 mr-1" />
                  {new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' })}
                </div>
              )}

              {task.description && (
                <div className="text-slate-400" title="Thẻ đã có miêu tả.">
                  <AlignLeft className="h-3.5 w-3.5" />
                </div>
              )}

              {(() => {
                const commentCount = (task.activities || []).filter(a => a.type === 'COMMENT').length;
                if (commentCount === 0) return null;
                return (
                  <div className="flex items-center text-[11px] text-slate-400 font-medium">
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    {commentCount}
                  </div>
                );
              })()}

              {(() => {
                const total = (task.checklists || []).reduce((acc, cl) => acc + (cl.items?.length || 0), 0);
                const done = (task.checklists || []).reduce((acc, cl) => acc + (cl.items?.filter((i: any) => i.isDone).length || 0), 0);
                if (total === 0) return null;
                return (
                  <div className="flex items-center text-[11px] text-slate-400 font-medium">
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    {done}/{total}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end mt-3 h-5">
              {task.assignees && task.assignees.length > 0 ? (
                <div className="flex -space-x-1.5">
                  {task.assignees.slice(0, 3).map((a) => (
                    <div key={a.id} className="w-5 h-5 rounded-full border border-white shadow-sm overflow-hidden bg-slate-100" title={a.displayName}>
                      <img src={a.avatarUrl || `https://ui-avatars.com/api/?name=${a.displayName}&background=random&size=20`} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {task.assignees.length > 3 && (
                    <div className="w-5 h-5 rounded-full border border-white shadow-sm overflow-hidden bg-slate-100 flex items-center justify-center text-[7px] font-bold text-slate-500">
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center bg-transparent">
                  <Users className="h-2.5 w-2.5 text-slate-300" />
                </div>
              )}
            </div>
          </div>
        );

        if (snapshot.isDragging) {
          return createPortal(cardContent, document.body);
        }
        return cardContent;
      }}
    </Draggable>
  );
}, (prev, next) => {
  // Only re-render if the task data has meaningfully changed
  return prev.task === next.task && 
         prev.index === next.index &&
         prev.boardBackground === next.boardBackground;
});

export default function ProjectBoard({ projectId, tasks, boardBackground, onTaskUpdate, onOptimisticUpdate, onUpdateTaskAppearance, onOptimisticReorder, onTaskClick, onAddTask }: ProjectBoardProps) {
  const { emit } = useSocket(projectId);
  const { user } = useAuthStore();
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  
  // Track the timestamp of the last local user interaction to ignore stale server updates
  const lastLocalUpdateRef = useRef(0);
  
  // Track the number of outgoing reorder requests to avoid middle-state flickering
  const pendingActionsRef = useRef(0);

  const handleOpenMenu = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY,
      left: rect.right + window.scrollX - 256 // Adjust based on popover width (w-64 = 256px)
    });
    setActiveMenuId(taskId);
  };

  const closeMenu = () => {
    setActiveMenuId(null);
    setMenuPosition(null);
  };

  // Drag-to-scroll horizontal board
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleUpdateAppearance = (taskId: string, data: { background?: string; textColor?: string }) => {
    // Rely on parent for centralized optimistic + socket update to prevent flicker
    if (onUpdateTaskAppearance) {
      onUpdateTaskAppearance(taskId, data);
    }
    
    closeMenu();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    
    // Don't trigger if clicking on something interactive or a card
    const target = e.target as HTMLElement;
    if (
      ['BUTTON', 'INPUT', 'TEXTAREA', 'A'].includes(target.tagName) || 
      target.closest('button') || 
      target.closest('[data-rbd-draggable-id]') ||
      target.closest('.group') // Cards have the 'group' class
    ) return;
    
    setIsMouseDown(true);
    // Add 'active' class to cursor while dragging
    scrollRef.current.classList.add('cursor-grabbing');
    scrollRef.current.classList.remove('cursor-grab');
    
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !scrollRef.current) return;
    
    // Use requestAnimationFrame for smoother scrolling
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  // Synchronize local tasks with props when they change externally, 
  // but protect local changes ONLY while there are pending server reorder requests.
  useEffect(() => {
    // 1. Never sync if we have pending local reorder actions (requests in flight)
    // to prevent the card from jumping back during rapid movements.
    if (pendingActionsRef.current > 0) return;
    
    // 2. Otherwise, synchronize immediately to allow Labels, Assignees, etc.
    // to update in real-time without any lag or cooldown.
    setLocalTasks(tasks);
  }, [tasks]);

  const onDragStart = () => {
    setIsDraggingCard(true);
  };

  const onDragEnd = (result: DropResult) => {
    setIsDraggingCard(false);
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const destStatus = destination.droppableId;
    
    // 1. Calculate new order and update LOCAL state immediately (Instant Feedback)
    const movingTask = localTasks.find(t => t.id === draggableId);
    if (!movingTask) return;

    // Record interaction timestamp to freeze server-sync temporarily
    lastLocalUpdateRef.current = Date.now();

    const filtered = localTasks.filter(t => t.id !== draggableId);
    const destInFiltered = filtered.filter(t => t.status === destStatus);
    destInFiltered.splice(destination.index, 0, { ...movingTask, status: destStatus });
    
    // Update local state first for 0ms lag
    setLocalTasks(prev => {
      const otherStatusTasks = prev.filter(t => t.id !== draggableId && t.status !== destStatus);
      return [...otherStatusTasks, ...destInFiltered];
    });

    const ids = destInFiltered.map(t => t.id);

    // 2. Call parent optimistic update (for other client synchronization)
    if (onOptimisticReorder) {
      onOptimisticReorder(ids, destStatus);
    }

    // 3. Socket broadcast with tracking
    pendingActionsRef.current += 1;
    emit('task:reorder', { projectId, taskIds: ids, status: destStatus }, (response: any) => {
      pendingActionsRef.current = Math.max(0, pendingActionsRef.current - 1);
      
      if (response.status === 'error') {
        toast.error(response.message || 'Failed to move task');
        onTaskUpdate(); // Rollback on failure
      }
    });
  };

  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="h-full w-full overflow-hidden flex flex-col bg-transparent">
        <div 
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="flex-1 flex overflow-x-auto overflow-y-hidden gap-6 custom-scrollbar cursor-grab pt-6"
        >
          {/* Left Spacer */}
          <div className="w-10 shrink-0" />

          {COLUMNS.map((col) => (
            <div 
              key={col.id} 
              className="w-80 shrink-0 flex flex-col h-fit max-h-full rounded-2xl border border-white/30 shadow-lg overflow-hidden mb-10"
              style={{ background: boardBackground ? 'rgba(255,255,255,0.18)' : '#ebecf0', backdropFilter: boardBackground ? 'blur(12px)' : 'none' }}
            >
              {/* Column Header */}
              <div className="p-4 flex items-center justify-between bg-white/40 border-b border-slate-200 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${col.color}`}>
                    {localTasks.filter(t => t.status === col.id).length}
                  </span>
                  <h3 className={`text-sm font-bold transition-colors ${boardBackground ? 'text-white' : 'text-slate-700'}`}>
                    {col.title}
                  </h3>
                </div>
              </div>

              {/* Cards Area - The only vertical scroll parent */}
              <StrictDroppable droppableId={col.id}>
                {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 custom-scrollbar transition-colors ${
                      snapshot.isDraggingOver ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    {localTasks.filter(t => t.status === col.id).map((task, index) => (
                      <TaskCard 
                        key={task.id}
                        task={task}
                        index={index}
                        boardBackground={boardBackground}
                        onTaskClick={onTaskClick}
                        handleOpenMenu={handleOpenMenu}
                      />
                    ))}
                    {provided.placeholder}
                    
                    {localTasks.filter(t => t.status === col.id).length === 0 && !snapshot.isDraggingOver && (
                       <div className={`h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-[10px] italic transition-colors ${
                         boardBackground ? 'border-white/20 text-white/50' : 'border-slate-300/40 text-slate-400'
                       }`}>
                          No tasks under {col.title}
                       </div>
                    )}
                  </div>
                )}
              </StrictDroppable>

              <button 
                onClick={() => onAddTask(col.id)}
                className={`m-3 p-2 flex items-center justify-center gap-2 text-[11px] font-bold rounded-lg transition-all ${
                  boardBackground 
                    ? 'text-white/70 hover:text-white hover:bg-white/10' 
                    : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                <Plus className="h-3 w-3" />
                Add Task
              </button>
            </div>
          ))}
          
          {/* Right Spacer */}
          <div className="w-10 shrink-0" />
        </div>
      </div>
      
      {/* Portaled Context Menu */}
      {activeMenuId && menuPosition && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={closeMenu} 
          />
          {/* Menu */}
          <div 
            className="fixed z-[9999]"
            style={{ 
              top: menuPosition.top, 
              left: menuPosition.left 
            }}
          >
            <TaskAppearancePopover 
              currentBackground={localTasks.find(t => t.id === activeMenuId)?.background || undefined}
              currentTextColor={localTasks.find(t => t.id === activeMenuId)?.textColor || undefined}
              onUpdate={(data) => handleUpdateAppearance(activeMenuId, data)}
            />
          </div>
        </>,
        document.body
      )}
    </DragDropContext>
  );
}
