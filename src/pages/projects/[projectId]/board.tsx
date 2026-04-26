import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import ProjectBoard from '@/components/Project/ProjectBoard';
import TaskDetailModal from '@/components/Project/TaskDetailModal';
import CreateTaskModal from '@/components/Modal/CreateTaskModal';
import BoardBackgroundPopover from '@/components/Project/BoardBackgroundPopover';
import axiosInstance from '@/lib/axios';
import { 
  Settings, 
  Users, 
  ChevronRight,
  Image as ImageIcon,
  Search
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/Layout/PageHeader';
import { useSocket, getSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';
import ManageMemberModal from '@/components/Modal/ManageMemberModal';
import { useAuthStore } from '@/store/authStore';
import { shouldShowTaskOnBoard } from '@/lib/boardTaskVisibility';
import { getBoardBackgroundStyle, type TaskCoverMode } from '@/lib/boardBackgroundStyle';

function insertCopiedTaskInColumn(prev: any[], columnStatus: string, position1Based: number, task: any): any[] {
  const insertAt = Math.max(0, position1Based - 1);
  const out: any[] = [];
  let colDone = false;
  for (const t of prev) {
    if (t.status !== columnStatus) {
      out.push(t);
      continue;
    }
    if (!colDone) {
      const inCol = prev.filter((x) => x.status === columnStatus);
      const col = [...inCol];
      col.splice(Math.min(insertAt, col.length), 0, task);
      out.push(...col);
      colDone = true;
      continue;
    }
  }
  if (!colDone) {
    out.push(task);
  }
  return out;
}

function buildOptimisticCopyTask(source: any, tempId: string, title: string, status: string): any {
  const checklists = Array.isArray(source?.checklists)
    ? source.checklists.map((cl: any) => ({
        ...cl,
        id: `${tempId}-cl-${cl.id}`,
        items: (cl.items || []).map((it: any) => ({
          ...it,
          id: `${tempId}-it-${it.id}`,
          isDone: false,
        })),
      }))
    : [];
  return {
    ...source,
    id: tempId,
    title,
    status,
    activities: [],
    attachments: [],
    checklists,
    subTasks: [],
  };
}

export default function BoardPage() {
  const router = useRouter();
  const { projectId: projectIdParam } = router.query;
  const projectId = useMemo(
    () => (Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam) as string | undefined,
    [projectIdParam]
  );
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [preselectedStatus, setPreselectedStatus] = useState<string>('PENDING');
  const [boardBackground, setBoardBackground] = useState<string | null>(null);
  const lastBgUpdateRef = useRef<number>(0);
  const lastTaskUpdatesRef = useRef<Record<string, number>>({});
  const [isBackgroundPopoverOpen, setIsBackgroundPopoverOpen] = useState<boolean | 'bg'>(false);
  const [boardSearch, setBoardSearch] = useState('');

  const { user } = useAuthStore() as { user: any };

  const myProjectMember = useMemo(
    () => members.find((m: any) => m.userId === user?.id),
    [members, user?.id]
  );

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [projectRes, tasksRes, membersRes] = await Promise.all([
        axiosInstance.get(`/projects/${projectId}`),
        axiosInstance.get(`/projects/${projectId}/tasks`),
        axiosInstance.get(`/projects/${projectId}/members`)
      ]);
      const p = projectRes.data;
      setProject(p);
      setTasks(tasksRes.data);
      setMembers(membersRes.data);
      setBoardBackground(typeof p?.background === 'string' && p.background.trim() ? p.background : null);
    } catch (error) {
      console.error('Error fetching board data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const { socket } = useSocket(projectId);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tasks.length > 0 && router.query.taskId) {
      const taskInUrl = tasks.find((t) => t.id === router.query.taskId);
      if (taskInUrl && (!selectedTask || selectedTask.id !== taskInUrl.id)) {
        setSelectedTask(taskInUrl);
        // Remove taskId from url so modal can be closed normally without reopening
        router.replace(`/projects/${projectId}/board`, undefined, { shallow: true });
      }
    }
  }, [tasks, router.query.taskId, projectId, router, selectedTask]);

  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return;
    const s = getSocket();
    if (!s) return;

    const hMoved = ({ taskId, status, task: updatedTask }: any) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status, ...updatedTask } : t)));
    };

    const hUpdated = (updatedTask: any) => {
      if (updatedTask.senderId === s.id) return;

      const lastUpdate = lastTaskUpdatesRef.current[updatedTask.id] || 0;
      if (updatedTask.updatedAt && updatedTask.updatedAt <= lastUpdate) return;

      if (updatedTask.updatedAt) {
        lastTaskUpdatesRef.current[updatedTask.id] = updatedTask.updatedAt;
      }

      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === updatedTask.id);
        const show = shouldShowTaskOnBoard(updatedTask, user?.id, myProjectMember);
        if (idx >= 0) {
          if (!show) {
            return prev.filter((t) => t.id !== updatedTask.id);
          }
          return prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
        }
        if (show) {
          return [updatedTask, ...prev];
        }
        return prev;
      });
      setSelectedTask((prev: any) => {
        if (prev?.id !== updatedTask.id) return prev;
        if (!shouldShowTaskOnBoard(updatedTask, user?.id, myProjectMember)) {
          return null;
        }
        return { ...prev, ...updatedTask };
      });
    };

    const hCreated = (newTask: any) => {
      setTasks((prev) => {
        if (prev.find((t) => t.id === newTask.id)) return prev;
        if (!shouldShowTaskOnBoard(newTask, user?.id, myProjectMember)) return prev;
        return [newTask, ...prev];
      });
    };

    const hDeleted = ({ taskId }: any) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTask((prev: any) => (prev?.id === taskId ? null : prev));
    };

    const hReordered = ({ taskIds, status, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) => {
        const otherTasks = prev.filter((t) => !taskIds.includes(t.id));
        const updatedTasksInStatus = taskIds
          .map((id: string) => {
            const task = prev.find((t) => t.id === id);
            return task ? { ...task, status } : null;
          })
          .filter(Boolean);
        return [...otherTasks, ...updatedTasksInStatus] as any[];
      });
    };

    const hBackground = ({ projectId: changedId, background, updatedAt, senderId, userId: authorUserId }: any) => {
      if (projectId && changedId === projectId) {
        if (authorUserId && user?.id && authorUserId === user.id) return;
        if (senderId === s.id) return;
        if (updatedAt && updatedAt <= lastBgUpdateRef.current) return;
        if (updatedAt) lastBgUpdateRef.current = updatedAt;
        setBoardBackground(typeof background === 'string' && background.trim() ? background : null);
        setProject((p: any) => (p ? { ...p, background } : p));
      }
    };

    const hActivityAdded = ({ taskId, activity }: any) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (t.activities?.some((a: any) => a.id === activity.id)) return t;
          return { ...t, activities: [activity, ...(t.activities || [])] };
        })
      );
    };

    const hActivityEdited = ({ activity }: any) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (!t.activities?.some((a: any) => a.id === activity.id)) return t;
          return {
            ...t,
            activities: t.activities.map((a: any) => (a.id === activity.id ? activity : a))
          };
        })
      );
    };

    const hActivityDeleted = ({ activityId }: any) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (!t.activities?.some((a: any) => a.id === activityId)) return t;
          return { ...t, activities: t.activities.filter((a: any) => a.id !== activityId) };
        })
      );
    };

    const hClCreated = ({ taskId, checklist, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (t.checklists?.some((c: any) => c.id === checklist.id)) return t;
          return { ...t, checklists: [...(t.checklists || []), checklist] };
        })
      );
    };

    const hClDeleted = ({ taskId, checklistId, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (!t.checklists?.some((c: any) => c.id === checklistId)) return t;
          return { ...t, checklists: t.checklists.filter((c: any) => c.id !== checklistId) };
        })
      );
    };

    const hItemAdded = ({ taskId, checklistId, checklistItem, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            checklists: t.checklists?.map((c: any) => {
              if (c.id !== checklistId) return c;
              if (c.items?.some((i: any) => i.id === checklistItem.id)) return c;
              return { ...c, items: [...(c.items || []), checklistItem] };
            })
          };
        })
      );
    };

    const hItemUpdated = ({ taskId, checklistId, checklistItem, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            checklists: t.checklists?.map((c: any) => {
              if (c.id !== checklistId) return c;
              return {
                ...c,
                items: c.items?.map((i: any) => (i.id === checklistItem.id ? checklistItem : i))
              };
            })
          };
        })
      );
    };

    const hItemDeleted = ({ taskId, checklistId, itemId }: any) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            checklists: t.checklists?.map((c: any) => {
              if (c.id !== checklistId) return c;
              return { ...c, items: c.items?.filter((i: any) => i.id !== itemId) };
            })
          };
        })
      );
    };

    s.on('task:moved', hMoved);
    s.on('task:updated', hUpdated);
    s.on('task:created', hCreated);
    s.on('task:deleted', hDeleted);
    s.on('tasks:reordered', hReordered);
    s.on('project:backgroundChanged', hBackground);
    s.on('activity:added', hActivityAdded);
    s.on('activity:edited', hActivityEdited);
    s.on('activity:deleted', hActivityDeleted);
    s.on('checklist:created', hClCreated);
    s.on('checklist:deleted', hClDeleted);
    s.on('checklistItem:added', hItemAdded);
    s.on('checklistItem:updated', hItemUpdated);
    s.on('checklistItem:deleted', hItemDeleted);

    return () => {
      s.off('task:moved', hMoved);
      s.off('task:updated', hUpdated);
      s.off('task:created', hCreated);
      s.off('task:deleted', hDeleted);
      s.off('tasks:reordered', hReordered);
      s.off('project:backgroundChanged', hBackground);
      s.off('activity:added', hActivityAdded);
      s.off('activity:edited', hActivityEdited);
      s.off('activity:deleted', hActivityDeleted);
      s.off('checklist:created', hClCreated);
      s.off('checklist:deleted', hClDeleted);
      s.off('checklistItem:added', hItemAdded);
      s.off('checklistItem:updated', hItemUpdated);
      s.off('checklistItem:deleted', hItemDeleted);
    };
  }, [projectId, user?.id, myProjectMember]);

  const handleOptimisticUpdate = useCallback((taskId: string, newStatus: string) => {
    setTasks(prev => prev.map((t: any) => t.id === taskId ? { ...t, status: newStatus } : t));
  }, []);

  const handleOptimisticTaskPatch = useCallback((taskId: string, patch: Record<string, unknown>) => {
    const now = Date.now();
    lastTaskUpdatesRef.current[taskId] = now;
    if (patch.archived === true) {
      setTasks((prev) => prev.filter((t: any) => t.id !== taskId));
      setSelectedTask((prev: any) => (prev?.id === taskId ? null : prev));
      return;
    }
    const { labelIds: _l, ...rest } = patch;
    setTasks((prev) => prev.map((t: any) => (t.id === taskId ? { ...t, ...rest } : t)));
  }, []);

  const handleUpdateTaskAppearance = useCallback((taskId: string, data: { background?: string; textColor?: string; coverMode?: TaskCoverMode | null }) => {
    // Record timestamp to ignore stale socket echoes
    const now = Date.now();
    lastTaskUpdatesRef.current[taskId] = now;

    const normalized =
      data.coverMode === 'FULL' ? { ...data, coverMode: 'SPLIT' as const } : data;

    // Optimistic UI update at the source of truth
    setTasks((prev) => prev.map((t: any) => (t.id === taskId ? { ...t, ...normalized } : t)));

    // Ảnh tạm từ file (blob:) — chỉ cập nhật UI, gửi server sau khi upload xong
    if (data.background && String(data.background).startsWith('blob:')) {
      return;
    }

    if (socket) {
      socket.emit('task:update', {
        taskId,
        projectId,
        userId: user?.id,
        updates: normalized,
        updatedAt: now,
        senderId: socket.id
      });
    }
  }, [projectId, socket, user?.id]);

  const handleLocalTaskUpdate = useCallback((updatedTask: any) => {
    // Record this as the latest update for this task
    lastTaskUpdatesRef.current[updatedTask.id] = Date.now();
    
    setTasks(prev => prev.map((t: any) => t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
  }, []);

  const handleOptimisticReorder = useCallback((taskIds: string[], status: string) => {
    setTasks(prev => {
      const otherTasks = prev.filter(t => !taskIds.includes(t.id));
      const updatedTasksInStatus = taskIds.map((id: string) => {
        const task = prev.find(t => t.id === id);
        return task ? { ...task, status } : null;
      }).filter(Boolean);
      
      return [...otherTasks, ...updatedTasksInStatus] as any[];
    });
  }, []);

  const handleOptimisticTaskCopy = useCallback(
    (args: { tempId: string; title: string; status: string; position: number; sourceTask: any }) => {
      const { tempId, title, status, position, sourceTask } = args;
      const optimistic = buildOptimisticCopyTask(sourceTask, tempId, title, status);
      lastTaskUpdatesRef.current[tempId] = Date.now();
      setTasks((prev) => insertCopiedTaskInColumn(prev, status, position, optimistic));
    },
    []
  );

  const handleCopyTaskConfirm = useCallback((tempId: string, serverTask: any) => {
    const now = Date.now();
    lastTaskUpdatesRef.current[serverTask.id] = now;
    setTasks((prev) => {
      const mapped = prev.map((t) => (t.id === tempId ? serverTask : t));
      const seen = new Set<string>();
      return mapped.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
    });
    setSelectedTask((prev: any) => (prev?.id === tempId ? serverTask : prev));
  }, []);

  const handleCopyTaskRollback = useCallback((tempId: string, message?: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== tempId));
    setSelectedTask((prev: any) => (prev?.id === tempId ? null : prev));
    if (message) {
      toast.error(message);
    }
  }, []);

  if (loading && !project) {
    return (
      <MainLayout>
        <div className="h-full flex items-center justify-center">
           <div className="flex flex-col items-center space-y-4">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Initializing Board...</span>
           </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout noPadding noScroll fullWidth>
      <Head>
        <title>{project ? `${project.name} - Bảng công việc | PMS` : 'Bảng công việc | PMS'}</title>
      </Head>
      <div
        className="relative z-[1] flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden board-page-active"
        style={boardBackground ? getBoardBackgroundStyle(boardBackground) : undefined}
      >
        <div className="shrink-0 px-10 pt-6">
          <PageHeader 
            title={project?.name ? `${project.name} / Bảng công việc` : 'Bảng công việc'}
            breadcrumbs={
            <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest gap-2">
              <Link href="/projects" className="hover:text-emerald-500 transition-colors">Projects</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-600">{project?.name}</span>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
               <button 
                 onClick={() => setIsMemberModalOpen(true)}
                 className="px-3 py-2 bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl text-slate-600 hover:bg-white transition-all shadow-sm flex items-center gap-2"
                 title="Manage Members"
               >
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-bold hidden sm:inline-block">Members</span>
               </button>

               {/* Settings Gear Dropdown */}
               <div className="relative">
                 <button 
                   onClick={() => setIsBackgroundPopoverOpen(p => p ? false : true)}
                   className={`p-2 backdrop-blur-sm border rounded-xl transition-all shadow-sm ${
                     isBackgroundPopoverOpen
                       ? 'bg-white border-slate-300 text-slate-800'
                       : 'bg-white/80 border-white/60 text-slate-600 hover:bg-white'
                   }`}
                   title="Board Settings"
                 >
                   <Settings className="h-4 w-4" />
                 </button>

                 {/* Dropdown menu */}
                 {isBackgroundPopoverOpen && (
                   <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                     {/* Dropdown Header */}
                     <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                       <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Board Settings</p>
                     </div>

                     {/* Dropdown Items */}
                     <div className="py-2">
                       {/* Change Background - opens sub-popover */}
                       <div className="relative group">
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             // Toggle sub-popover by setting a specific key
                             setIsBackgroundPopoverOpen('bg');
                           }}
                           className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 font-medium transition-colors"
                         >
                           <ImageIcon className="h-4 w-4 text-slate-400" />
                           <span className="whitespace-nowrap">Change Background</span>
                           {boardBackground && (
                             <div
                               className="ml-auto w-5 h-5 rounded-full border border-slate-200 shadow-sm overflow-hidden"
                               style={getBoardBackgroundStyle(boardBackground)}
                             />
                           )}
                         </button>
                       </div>
                     </div>

                     {/* Click outside backdrop */}
                     <div className="fixed inset-0 -z-10" onClick={() => setIsBackgroundPopoverOpen(false)} />
                   </div>
                 )}

                 {/* Background Popover sub-panel */}
                 {isBackgroundPopoverOpen === 'bg' && projectId && (
                   <BoardBackgroundPopover
                     projectId={projectId}
                     currentBackground={boardBackground}
                     onClose={() => setIsBackgroundPopoverOpen(false)}
                     onBackgroundChange={(bg) => {
                       lastBgUpdateRef.current = Date.now();
                       setBoardBackground(bg);
                       setProject((prev: any) => (prev ? { ...prev, background: bg } : prev));
                       setIsBackgroundPopoverOpen(false);
                     }}
                   />
                 )}
               </div>
            </div>
          }
        />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-10 pb-3 flex justify-end">
          <div className="relative w-full max-w-sm group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Tìm kiếm công việc..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/90 backdrop-blur-sm border border-slate-200/90 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all shadow-sm"
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
           <ProjectBoard 
              projectId={projectId!} 
              projectName={project?.name || 'Bảng dự án'}
              tasks={tasks}
              searchTerm={boardSearch}
              onTaskUpdate={fetchData} 
              onOptimisticUpdate={handleOptimisticUpdate}
              onOptimisticTaskPatch={handleOptimisticTaskPatch}
              onUpdateTaskAppearance={handleUpdateTaskAppearance}
              onOptimisticReorder={handleOptimisticReorder}
              onOptimisticTaskCopy={handleOptimisticTaskCopy}
              onCopyTaskConfirm={handleCopyTaskConfirm}
              onCopyTaskRollback={handleCopyTaskRollback}
              onTaskClick={(task) => setSelectedTask(task)}
              onAddTask={(status) => {
                setPreselectedStatus(status);
                setIsCreateModalOpen(true);
              }}
           />
        </div>
        </div>
      </div>
      
      {/* Task Detail Modal */}
      <TaskDetailModal 
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        projectId={projectId as string}
        projectName={project?.name || 'Bảng dự án'}
        boardTasks={tasks.map((t) => ({ id: t.id, status: t.status }))}
        onOptimisticTaskCopy={handleOptimisticTaskCopy}
        onCopyTaskConfirm={handleCopyTaskConfirm}
        onCopyTaskRollback={handleCopyTaskRollback}
        onUpdate={fetchData}
        onDataChange={handleLocalTaskUpdate}
        projectMembersList={members}
      />

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId as string}
        departments={[]} // Fetch if needed, but usually empty for project-scoped tasks
        members={members}
        onSuccess={fetchData}
        initialStatus={preselectedStatus}
      />
      
      {project && (
        <ManageMemberModal
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          projectId={projectId as string}
          departmentId={project.owner?.departmentId}
          onSuccess={fetchData}
        />
      )}
    </MainLayout>
  );
}
