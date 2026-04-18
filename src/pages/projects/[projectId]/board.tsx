import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import ProjectBoard from '@/components/Project/ProjectBoard';
import TaskDetailModal from '@/components/Project/TaskDetailModal';
import CreateTaskModal from '@/components/Modal/CreateTaskModal';
import BoardBackgroundPopover from '@/components/Project/BoardBackgroundPopover';
import axiosInstance from '@/lib/axios';
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  ChevronRight,
  Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/Layout/PageHeader';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';
import ManageMemberModal from '@/components/Modal/ManageMemberModal';
import { useAuthStore } from '@/store/authStore';

export default function BoardPage() {
  const router = useRouter();
  const { projectId } = router.query;
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

  const { user } = useAuthStore() as { user: any };

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [projectRes, tasksRes, membersRes] = await Promise.all([
        axiosInstance.get(`/projects/${projectId}`),
        axiosInstance.get(`/projects/${projectId}/tasks`),
        axiosInstance.get(`/projects/${projectId}/members`)
      ]);
      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setMembers(membersRes.data);
      // Set board background from project data
      setBoardBackground(projectRes.data.background || null);
    } catch (error) {
      console.error('Error fetching board data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const { on, off, emit, socket } = useSocket(projectId as string);

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
    if (!projectId) return;

    // Direct Push-Update logic
    on('task:moved', ({ taskId, status, task: updatedTask }: any) => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, ...updatedTask } : t));
    });

    on('task:updated', (updatedTask: any) => {
      // Ignore if echo from same socket
      if (updatedTask.senderId === socket?.id) return;
      
      // Ignore if stale update
      const lastUpdate = lastTaskUpdatesRef.current[updatedTask.id] || 0;
      if (updatedTask.updatedAt && updatedTask.updatedAt <= lastUpdate) return;
      
      if (updatedTask.updatedAt) {
          lastTaskUpdatesRef.current[updatedTask.id] = updatedTask.updatedAt;
      }

      setTasks(prev => prev.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
      // Update selected task if it's the one being updated
      setSelectedTask((prev: any) => prev?.id === updatedTask.id ? { ...prev, ...updatedTask } : prev);
    });

    on('task:created', (newTask: any) => {
      setTasks(prev => {
        if (prev.find(t => t.id === newTask.id)) return prev;
        return [newTask, ...prev];
      });
    });

    on('task:deleted', ({ taskId }: any) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSelectedTask((prev: any) => prev?.id === taskId ? null : prev);
    });

    on('tasks:reordered', ({ taskIds, status, senderId }: any) => {
      if (senderId === socket?.id) return;

      setTasks(prev => {
        // Move tasks to the new status and order them
        const otherTasks = prev.filter(t => !taskIds.includes(t.id));
        const updatedTasksInStatus = taskIds.map((id: string) => {
          const task = prev.find(t => t.id === id);
          return task ? { ...task, status } : null;
        }).filter(Boolean);
        
        return [...otherTasks, ...updatedTasksInStatus] as any[];
      });
    });

    on('project:backgroundChanged', ({ projectId: changedId, background, updatedAt, senderId }: any) => {
      if (changedId === projectId) {
        // Ignore if echo from same socket
        if (senderId === socket?.id) return;
        
        // Ignore if stale update
        if (updatedAt && updatedAt <= lastBgUpdateRef.current) return;
        
        if (updatedAt) lastBgUpdateRef.current = updatedAt;
        setBoardBackground(background);
      }
    });

    on('activity:added', ({ taskId, activity }: any) => {
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        if (t.activities?.some((a: any) => a.id === activity.id)) return t;
        return { ...t, activities: [activity, ...(t.activities || [])] };
      }));
    });

    on('activity:edited', ({ activity }: any) => {
      setTasks(prev => prev.map(t => {
        if (!t.activities?.some((a: any) => a.id === activity.id)) return t;
        return {
          ...t,
          activities: t.activities.map((a: any) => a.id === activity.id ? activity : a)
        };
      }));
    });

    on('activity:deleted', ({ activityId }: any) => {
      setTasks(prev => prev.map(t => {
        if (!t.activities?.some((a: any) => a.id === activityId)) return t;
        return {
          ...t,
          activities: t.activities.filter((a: any) => a.id !== activityId)
        };
      }));
    });

    on('checklist:created', ({ taskId, checklist, senderId }: any) => {
      if (senderId === socket?.id) return;
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        if (t.checklists?.some((c: any) => c.id === checklist.id)) return t;
        return { ...t, checklists: [...(t.checklists || []), checklist] };
      }));
    });

    on('checklist:deleted', ({ taskId, checklistId, senderId }: any) => {
      if (senderId === socket?.id) return;
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        if (!t.checklists?.some((c: any) => c.id === checklistId)) return t;
        return { ...t, checklists: t.checklists.filter((c: any) => c.id !== checklistId) };
      }));
    });

    on('checklistItem:added', ({ taskId, checklistId, checklistItem, senderId }: any) => {
      if (senderId === socket?.id) return;
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          checklists: t.checklists?.map((c: any) => {
            if (c.id !== checklistId) return c;
            if (c.items?.some((i: any) => i.id === checklistItem.id)) return c;
            return { ...c, items: [...(c.items || []), checklistItem] };
          })
        };
      }));
    });

    on('checklistItem:updated', ({ taskId, checklistId, checklistItem, senderId }: any) => {
      if (senderId === socket?.id) return;
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          checklists: t.checklists?.map((c: any) => {
            if (c.id !== checklistId) return c;
            return { ...c, items: c.items?.map((i: any) => i.id === checklistItem.id ? checklistItem : i) };
          })
        };
      }));
    });

    on('checklistItem:deleted', ({ taskId, checklistId, itemId }: any) => {
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          checklists: t.checklists?.map((c: any) => {
            if (c.id !== checklistId) return c;
            return { ...c, items: c.items?.filter((i: any) => i.id !== itemId) };
          })
        };
      }));
    });

    return () => {
      off('task:moved');
      off('task:updated');
      off('task:created');
      off('task:deleted');
      off('tasks:reordered');
      off('project:backgroundChanged');
      off('activity:added');
      off('activity:edited');
      off('activity:deleted');
      off('checklist:created');
      off('checklist:deleted');
      off('checklistItem:added');
      off('checklistItem:updated');
      off('checklistItem:deleted');
    };
  }, [on, off, projectId, socket?.id]);

  const handleOptimisticUpdate = useCallback((taskId: string, newStatus: string) => {
    setTasks(prev => prev.map((t: any) => t.id === taskId ? { ...t, status: newStatus } : t));
  }, []);

  const handleUpdateTaskAppearance = useCallback((taskId: string, data: { background?: string, textColor?: string }) => {
    // Record timestamp to ignore stale socket echoes
    const now = Date.now();
    lastTaskUpdatesRef.current[taskId] = now;

    // Optimistic UI update at the source of truth
    setTasks(prev => prev.map((t: any) => t.id === taskId ? { ...t, ...data } : t));

    // Emit via socket
    if (socket) {
      socket.emit('task:update', {
        taskId,
        projectId,
        userId: user?.id,
        updates: data,
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
      {/* Full-bleed background layer — covers content area only (below topbar, right of sidebar) */}
      {boardBackground && (
        <div
          className="fixed bottom-0 right-0 top-16 left-64 transition-all duration-500 pointer-events-none"
          style={{
            zIndex: 0,
            ...(boardBackground.startsWith('linear-gradient') || boardBackground.startsWith('#') || boardBackground.startsWith('rgb')
              ? { background: boardBackground }
              : { backgroundImage: `url(${boardBackground})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' })
          }}
        />
      )}

      <div className="flex flex-col h-full relative board-page-active" style={{ zIndex: 1 }}>
        <div className="px-10 pt-6">
          <PageHeader 
            title={
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <LayoutDashboard className="h-5 w-5 text-emerald-600" />
              </div>
              <span>{project?.name || 'Loading...'} / Board</span>
            </div>
          }
          description="Manage tasks and collaborate with your team in real-time."
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
                               className="ml-auto w-5 h-5 rounded-full border border-slate-200 shadow-sm"
                               style={{
                                 background: boardBackground.startsWith('http') ? `url(${boardBackground}) center/cover` : boardBackground
                               }}
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
                 {isBackgroundPopoverOpen === 'bg' && (
                   <BoardBackgroundPopover
                     projectId={projectId as string}
                     currentBackground={boardBackground}
                     onClose={() => setIsBackgroundPopoverOpen(false)}
                     onBackgroundChange={(bg) => {
                       lastBgUpdateRef.current = Date.now();
                       setBoardBackground(bg);
                       setIsBackgroundPopoverOpen(false);
                     }}
                   />
                 )}
               </div>
            </div>
          }
        />
        </div>

        {/* Board Container */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
           <ProjectBoard 
              projectId={projectId as string} 
              tasks={tasks}
              boardBackground={boardBackground}
              onTaskUpdate={fetchData} 
              onOptimisticUpdate={handleOptimisticUpdate}
              onUpdateTaskAppearance={handleUpdateTaskAppearance}
              onOptimisticReorder={handleOptimisticReorder}
              onTaskClick={(task) => setSelectedTask(task)}
              onAddTask={(status) => {
                setPreselectedStatus(status);
                setIsCreateModalOpen(true);
              }}
           />
        </div>
      </div>
      
      {/* Task Detail Modal */}
      <TaskDetailModal 
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        projectId={projectId as string}
        onUpdate={fetchData}
        onDataChange={handleLocalTaskUpdate}
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
