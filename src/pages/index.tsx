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
  CheckSquare,
  Clock,
  Plus,
  ChevronRight,
  ExternalLink,
  Layers,
  Users,
  ListTodo,
  UserCircle,
  CalendarDays,
} from 'lucide-react';
import { taskTitleToPlainText, taskDescriptionToPlainText } from '@/lib/taskDescription';
import { toast } from 'sonner';
import { useSocket, getSocket } from '@/hooks/useSocket';

const TASK_STATUS_VI: Record<string, string> = {
  PENDING: 'Chưa thực hiện',
  IN_PROGRESS: 'Đang làm',
  WAITING_FOR_DOCUMENT: 'Chờ hồ sơ',
  DONE: 'Hoàn thiện',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  DELAYED: 'Trễ hạn',
};

const TASK_STATUS_PILL: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-800 border-blue-200',
  WAITING_FOR_DOCUMENT: 'bg-orange-50 text-orange-800 border-orange-200',
  DONE: 'bg-teal-50 text-teal-800 border-teal-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
  DELAYED: 'bg-red-50 text-red-800 border-red-200',
};

export default function Home() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<{ tasks: any[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);
  useSocket(undefined, user?.id);

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
    if (typeof window === 'undefined') return;
    const s = getSocket();
    const hMoved = ({ taskId, status, task: updatedTask }: any) => {
      setDashboardData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t: any) => (t.id === taskId ? { ...t, status, ...updatedTask } : t))
        };
      });
    };
    const hUpdated = (updatedTask: any) => {
      setDashboardData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t: any) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
        };
      });
    };
    const hCreated = (newTask: any) => {
      setDashboardData((prev: any) => {
        if (!prev) return prev;
        if (prev.tasks.find((t: any) => t.id === newTask.id)) return prev;
        return {
          ...prev,
          tasks: [newTask, ...prev.tasks],
          stats: { ...prev.stats, activeTasks: (prev.stats.activeTasks || 0) + 1 }
        };
      });
    };
    const hDeleted = ({ taskId }: any) => {
      setDashboardData((prev: any) => {
        if (!prev) return prev;
        const taskToDelete = prev.tasks.find((t: any) => t.id === taskId);
        return {
          ...prev,
          tasks: prev.tasks.filter((t: any) => t.id !== taskId),
          stats: {
            ...prev.stats,
            activeTasks:
              taskToDelete && taskToDelete.status !== 'DONE' ? prev.stats.activeTasks - 1 : prev.stats.activeTasks
          }
        };
      });
    };
    const hProjectCreated = (newProject: any) => {
      setProjects((prev) => {
        if (prev.find((p) => p.id === newProject.id)) return prev;
        return [newProject, ...prev];
      });
    };
    const hProjectUpdated = (updatedProject: any) => {
      setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? { ...p, ...updatedProject } : p)));
    };
    const hProjectDeleted = ({ projectId: deletedId }: { projectId: string }) => {
      setProjects((prev) => prev.filter((p) => p.id !== deletedId));
    };
    s.on('task:moved', hMoved);
    s.on('task:updated', hUpdated);
    s.on('task:created', hCreated);
    s.on('task:deleted', hDeleted);
    s.on('project:created', hProjectCreated);
    s.on('project:updated', hProjectUpdated);
    s.on('project:deleted', hProjectDeleted);
    return () => {
      s.off('task:moved', hMoved);
      s.off('task:updated', hUpdated);
      s.off('task:created', hCreated);
      s.off('task:deleted', hDeleted);
      s.off('project:created', hProjectCreated);
      s.off('project:updated', hProjectUpdated);
      s.off('project:deleted', hProjectDeleted);
    };
  }, []);

  const stats = [
    { label: 'Tổng số dự án', value: projects.length, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Việc đang làm', value: dashboardData?.stats?.activeTasks || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Đã hoàn thành', value: dashboardData?.stats?.completedTasks || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Thành viên nhóm', value: dashboardData?.stats?.teamSize || 0, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
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
          title={<>Chào mừng trở lại, <span className="text-emerald-600">{user?.displayName}</span> 👋</>}
          description="Dưới đây là những gì đang diễn ra với các dự án của bạn hôm nay."
          actions={
            <button 
              onClick={() => router.push('/projects')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center transition-all shadow-lg shadow-emerald-200 active:scale-95"
            >
              <Plus className="h-4 w-4 mr-2" /> Dự án mới
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
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thống kê</span>
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
                Bảng công việc của bạn
              </h2>
              <button onClick={() => router.push('/projects')} className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center transition-colors">
                Xem tất cả <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              {projects.length > 0 ? (
                projects.map((project: any) => {
                  const myTasksHere =
                    dashboardData?.tasks?.filter((t: any) => t.projectId === project.id) ?? [];
                  const myDone = myTasksHere.filter((t: any) =>
                    ['DONE', 'APPROVED'].includes(t.status)
                  ).length;
                  const myActive = myTasksHere.filter(
                    (t: any) => !['DONE', 'APPROVED'].includes(t.status)
                  ).length;
                  const myProgressPct = myTasksHere.length
                    ? Math.round((myDone / myTasksHere.length) * 100)
                    : 0;
                  const descPlain = project.description
                    ? taskDescriptionToPlainText(project.description, 280)
                    : '';
                  const ownerName = project.owner?.displayName ?? '—';
                  const taskTotal = project._count?.tasks ?? 0;
                  const memberTotal = project._count?.members ?? 0;
                  const updatedLabel = project.updatedAt
                    ? new Date(project.updatedAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';

                  const openBoard = () => router.push(`/projects/${project.id}/board`);

                  return (
                    <article
                      key={project.id}
                      role="button"
                      tabIndex={0}
                      onClick={openBoard}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openBoard();
                        }
                      }}
                      className="group cursor-pointer rounded-md border border-slate-200 bg-white text-left shadow-sm outline-none transition-all hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                    >
                      <div className="flex border-b border-slate-200">
                        <div
                          className="w-1 shrink-0 bg-emerald-600"
                          aria-hidden
                        />
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-3 bg-slate-50/90 px-4 py-3">
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-emerald-800">
                              {project.name}
                            </h3>
                            <p className="mt-1 text-[11px] font-medium tabular-nums text-slate-500">
                              {taskTotal} thẻ · {memberTotal} thành viên
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBoard();
                            }}
                            className="shrink-0 rounded border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            aria-label="Mở bảng"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 px-4 py-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="flex gap-2">
                            <UserCircle
                              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Chủ dự án
                              </p>
                              <p className="truncate text-xs font-medium text-slate-800">
                                {ownerName}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <CalendarDays
                              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Cập nhật
                              </p>
                              <p className="text-xs font-medium tabular-nums text-slate-800">
                                {updatedLabel}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <ListTodo
                              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Thẻ (dự án)
                              </p>
                              <p className="text-xs font-medium tabular-nums text-slate-800">
                                {taskTotal}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Users
                              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Thành viên
                              </p>
                              <p className="text-xs font-medium tabular-nums text-slate-800">
                                {memberTotal}
                              </p>
                            </div>
                          </div>
                        </div>

                        {descPlain ? (
                          <div className="rounded border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Tóm tắt mô tả
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-700 line-clamp-3">
                              {descPlain}
                            </p>
                          </div>
                        ) : (
                          <p className="rounded border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2 text-xs italic text-slate-400">
                            Chưa có mô tả dự án.
                          </p>
                        )}

                        {myTasksHere.length > 0 ? (
                          <div className="border-t border-slate-100 pt-3">
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                              <span className="font-medium text-slate-700">
                                Việc được giao cho bạn
                              </span>
                              <span className="tabular-nums">
                                <span className="font-semibold text-amber-700">{myActive}</span>
                                <span className="text-slate-400"> đang xử lý · </span>
                                <span className="font-semibold text-emerald-700">{myDone}</span>
                                <span className="text-slate-400"> / {myTasksHere.length} hoàn thành</span>
                              </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-600 transition-all"
                                style={{ width: `${myProgressPct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                            Bạn chưa có thẻ được giao trong dự án này.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="col-span-full rounded-lg border-2 border-dashed border-slate-200 bg-white py-14 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-slate-100">
                    <Layers className="h-7 w-7 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Chưa có dự án</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                    Tạo dự án đầu tiên để bắt đầu theo dõi công việc.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/projects')}
                    className="mt-6 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    Tạo dự án
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/90">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                  <CheckSquare className="h-5 w-5 text-emerald-600 shrink-0" />
                  Công việc được giao
                </h3>
                <button
                  type="button"
                  onClick={() => router.push('/projects')}
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Mở dự án →
                </button>
              </div>
              <div className="overflow-x-auto">
                {dashboardData?.tasks && dashboardData.tasks.length > 0 ? (
                  <table className="w-full text-sm text-left text-slate-600 min-w-[640px]">
                    <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Công việc</th>
                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Dự án</th>
                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Trạng thái</th>
                        <th className="px-5 py-3 font-semibold whitespace-nowrap">Hạn chót</th>
                        <th className="px-5 py-3 font-semibold text-right whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboardData.tasks.slice(0, 20).map((task: any) => {
                        const title = taskTitleToPlainText(task.title) || 'Không có tiêu đề';
                        const statusKey = task.status || 'PENDING';
                        const pill =
                          TASK_STATUS_PILL[statusKey] ||
                          'bg-slate-50 text-slate-700 border-slate-200';
                        const due = task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString('vi-VN')
                          : '—';
                        return (
                          <tr
                            key={task.id}
                            className="hover:bg-slate-50/80 transition-colors group"
                          >
                            <td className="px-5 py-3.5 font-medium text-slate-900 max-w-[280px]">
                              <span className="line-clamp-2" title={title}>
                                {title}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                              {task.project?.name || '—'}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${pill}`}
                              >
                                {TASK_STATUS_VI[statusKey] || statusKey}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap tabular-nums">
                              {due}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/projects/${task.projectId}/board?taskId=${task.id}`
                                  )
                                }
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                              >
                                Mở thẻ
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-12 text-center text-slate-500 text-sm">
                    Chưa có công việc nào được giao cho bạn.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-8">
             <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                   <h3 className="text-xl font-black mb-2">Tổng quan</h3>
                   <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                      Bạn có{' '}
                      <span className="text-emerald-400 font-bold">
                        {dashboardData?.stats?.activeTasks ?? 0} việc đang xử lý
                      </span>{' '}
                      trên {projects.length} dự án.
                   </p>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                         <span>Tiến độ hoàn thành</span>
                         <span>
                           {Math.round(
                             ((dashboardData?.stats?.completedTasks || 0) /
                               (dashboardData?.stats?.totalTasks || 1)) *
                               100
                           )}
                           %
                         </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                         <div
                           className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-1000"
                           style={{
                             width: `${((dashboardData?.stats?.completedTasks || 0) / (dashboardData?.stats?.totalTasks || 1)) * 100}%`,
                           }}
                         />
                      </div>
                   </div>
                </div>
                <BarChart3 className="absolute -right-8 -bottom-8 h-40 w-40 text-emerald-500 opacity-10" />
             </div>
          </section>

        </div>
      </div>
    </MainLayout>
  );
}
