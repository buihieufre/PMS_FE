import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MainLayout from '@/components/Layout/MainLayout';
import { PageHeader } from '@/components/Layout/PageHeader';
import { useAuthStore } from '@/store/authStore';
import axiosInstance from '@/lib/axios';
import { 
  BarChart3, 
  Layout, 
  CheckCircle2, 
  Clock, 
  Plus, 
  ChevronRight,
  ExternalLink,
  Layers,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';

export default function Home() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<{ tasks: any[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const { on } = useSocket(undefined, user?.id);

  const fetchData = async () => {
    try {
      const [projectsRes, dashboardRes] = await Promise.all([
        axiosInstance.get('/projects'),
        axiosInstance.get('/tasks/my-tasks')
      ]);
      setProjects(projectsRes.data);
      setDashboardData(dashboardRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Could not load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Listen for real-time updates that affect the dashboard
    on('task:moved', ({ taskId, status, task: updatedTask }: any) => {
      setDashboardData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t: any) => t.id === taskId ? { ...t, status, ...updatedTask } : t)
        };
      });
    });

    on('task:updated', (updatedTask: any) => {
      setDashboardData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t: any) => t.id === updatedTask.id ? { ...t, ...updatedTask } : t)
        };
      });
    });

    on('task:created', (newTask: any) => {
      setDashboardData((prev: any) => {
        if (!prev) return prev;
        // Only add if it belongs to me or should be in my active tasks
        if (prev.tasks.find((t: any) => t.id === newTask.id)) return prev;
        return {
          ...prev,
          tasks: [newTask, ...prev.tasks],
          stats: { ...prev.stats, activeTasks: (prev.stats.activeTasks || 0) + 1 }
        };
      });
    });

    on('task:deleted', ({ taskId }: any) => {
      setDashboardData((prev: any) => {
        if (!prev) return prev;
        const taskToDelete = prev.tasks.find((t: any) => t.id === taskId);
        return {
          ...prev,
          tasks: prev.tasks.filter((t: any) => t.id !== taskId),
          stats: { 
            ...prev.stats, 
            activeTasks: taskToDelete && taskToDelete.status !== 'DONE' ? (prev.stats.activeTasks - 1) : prev.stats.activeTasks 
          }
        };
      });
    });

    on('project:created', (newProject: any) => {
      setProjects(prev => {
        if (prev.find(p => p.id === newProject.id)) return prev;
        return [newProject, ...prev];
      });
    });

    on('project:updated', (updatedProject: any) => {
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p));
    });

    on('project:deleted', ({ projectId: deletedId }: any) => {
      setProjects(prev => prev.filter(p => p.id !== deletedId));
    });
  }, [on]);

  const stats = [
    { label: 'Total Projects', value: projects.length, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Tasks', value: dashboardData?.stats?.activeTasks || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Completed', value: dashboardData?.stats?.completedTasks || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Team Members', value: dashboardData?.stats?.teamSize || 0, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <MainLayout>
      <Head>
        <title>Dashboard | Antigravity PMS</title>
      </Head>

      <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <PageHeader 
          title={<>Welcome back, <span className="text-emerald-600">{user?.displayName}</span> 👋</>}
          description="Here is what is happening with your projects today."
          actions={
            <button 
              onClick={() => router.push('/projects')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center transition-all shadow-lg shadow-emerald-200 active:scale-95"
            >
              <Plus className="h-4 w-4 mr-2" /> New Project
            </button>
          }
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stats</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Recent Boards (Trello Style Grid) */}
          <section className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <Layout className="h-5 w-5 mr-3 text-emerald-500" />
                Your Boards
              </h2>
              <button onClick={() => router.push('/projects')} className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center transition-colors">
                View all <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.length > 0 ? projects.map((project) => (
                <div 
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}/board`)}
                  className="group relative bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden border-t-4 border-t-emerald-500 active:scale-[0.98]"
                >
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                        {project.name}
                      </h3>
                      <button className="p-2 bg-slate-50 rounded-lg group-hover:bg-emerald-50 transition-colors">
                        <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                      {project.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center space-x-2 pt-2">
                       <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                               U{i}
                            </div>
                          ))}
                       </div>
                       <span className="text-xs text-slate-400 font-medium">+5 more</span>
                    </div>
                  </div>
                  {/* Decorative Background Icon */}
                  <Layout className="absolute -right-4 -bottom-4 h-24 w-24 text-slate-50 opacity-[0.03] group-hover:opacity-10 transition-opacity rotate-12" />
                </div>
              )) : (
                <div className="col-span-full py-16 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                   <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Layers className="h-8 w-8 text-slate-300" />
                   </div>
                   <h3 className="text-lg font-bold text-slate-900">No projects yet</h3>
                   <p className="text-slate-500 text-sm mb-6">Start your first project and get organized like a pro.</p>
                   <button 
                     onClick={() => router.push('/projects')}
                     className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100"
                   >
                     Create First Project
                   </button>
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Active Tasks & Notifications */}
          <section className="space-y-8">
             <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                   <h3 className="text-xl font-black mb-2">Workspace Insight</h3>
                   <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                      You have <span className="text-emerald-400 font-bold">{dashboardData?.stats?.activeTasks || 0} active tasks</span> assigned to you across {projects.length} projects.
                   </p>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                         <span>Overall Progress</span>
                         <span>{Math.round(((dashboardData?.stats?.completedTasks || 0) / (dashboardData?.stats?.totalTasks || 1)) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-1000" 
                           style={{ width: `${((dashboardData?.stats?.completedTasks || 0) / (dashboardData?.stats?.totalTasks || 1)) * 100}%` }}
                         />
                      </div>
                   </div>
                </div>
                <BarChart3 className="absolute -right-8 -bottom-8 h-40 w-40 text-emerald-500 opacity-10" />
             </div>

             <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-900">Active Tasks</h3>
                   <button className="text-xs font-bold text-emerald-600 hover:underline">View All</button>
                </div>
                <div className="space-y-4">
                   {dashboardData?.tasks?.slice(0, 5).map((task: any) => (
                      <div key={task.id} className="flex items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100 group">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mr-4 ${
                           task.status === 'DONE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                         }`}>
                            <CheckCircle2 className="h-5 w-5" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                              {task.title}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">{task.project?.name || 'General'}</p>
                         </div>
                      </div>
                   )) || (
                     <p className="text-center text-slate-400 text-sm py-8">No active tasks.</p>
                   )}
                </div>
             </div>
          </section>

        </div>
      </div>
    </MainLayout>
  );
}
