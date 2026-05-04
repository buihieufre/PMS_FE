import { useState, useEffect, useMemo, useCallback } from 'react';
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

const PROJECT_ROLE_VI: Record<string, string> = {
  PROJECT_OWNER: 'Chủ dự án',
  TEAM_LEAD: 'Trưởng nhóm',
  EMPLOYEE: 'Nhân viên',
};

type DashboardCopy = {
  pageDescription: string;
  boardsHeading: string;
  boardsSubline: string;
  detailTitle: string;
  detailSubtitle: string;
  emptyGrid: string;
  emptyDetail: string;
  statsProjectLabel: string;
  allProjectsLink: string;
};

const DASHBOARD_COPY: Record<string, DashboardCopy> = {
  ADMIN: {
    pageDescription:
      'Góc quản trị: mọi dự án trong hệ thống và công việc được giao cho bạn.',
    boardsHeading: 'Tất cả dự án',
    boardsSubline: 'Danh sách đầy đủ theo quyền Admin; nhấn để mở bảng.',
    detailTitle: 'Chi tiết các dự án',
    detailSubtitle:
      'Tiến độ = thẻ đã xong / đã duyệt trên tổng thẻ đang hoạt động (chưa lưu trữ).',
    emptyGrid: 'Chưa có dự án nào trong hệ thống.',
    emptyDetail: 'Không có dự án để hiển thị.',
    statsProjectLabel: 'Dự án (toàn hệ thống)',
    allProjectsLink: 'Quản lý dự án',
  },
  OWNER: {
    pageDescription:
      'Các dự án bạn sở hữu (owner) hoặc đang tham gia với tư cách thành viên.',
    boardsHeading: 'Tất cả dự án',
    boardsSubline:
      'Gồm dự án có bạn là chủ sở hữu bản ghi và dự án bạn được thêm vào nhóm.',
    detailTitle: 'Chi tiết các dự án',
    detailSubtitle:
      'Tiến độ = thẻ đã xong / đã duyệt trên tổng thẻ đang hoạt động (chưa lưu trữ).',
    emptyGrid: 'Bạn chưa có dự án nào trong phạm vi này.',
    emptyDetail: 'Không có dự án trong phạm vi này.',
    statsProjectLabel: 'Dự án (owner & thành viên)',
    allProjectsLink: 'Tất cả dự án của tôi',
  },
  LEAD: {
    pageDescription:
      'Các dự án bạn tham gia với vai trò Trưởng nhóm trong dự án.',
    boardsHeading: 'Tất cả dự án',
    boardsSubline: 'Chỉ dự án có bạn là TEAM_LEAD.',
    detailTitle: 'Chi tiết dự án (Trưởng nhóm)',
    detailSubtitle:
      'Tiến độ = thẻ đã xong / đã duyệt trên tổng thẻ đang hoạt động (chưa lưu trữ).',
    emptyGrid: 'Bạn chưa là trưởng nhóm trong dự án nào.',
    emptyDetail: 'Không có dự án trong phạm vi này.',
    statsProjectLabel: 'Dự án (trưởng nhóm)',
    allProjectsLink: 'Tất cả dự án của tôi',
  },
  EMPLOYEE: {
    pageDescription:
      'Các dự án bạn tham gia với tư cách nhân viên.',
    boardsHeading: 'Tất cả dự án',
    boardsSubline: 'Chỉ dự án có bạn là nhân viên.',
    detailTitle: 'Chi tiết dự án (Nhân viên)',
    detailSubtitle:
      'Tiến độ = thẻ đã xong / đã duyệt trên tổng thẻ đang hoạt động (chưa lưu trữ).',
    emptyGrid: 'Bạn chưa tham gia dự án nào với vai trò nhân viên.',
    emptyDetail: 'Không có dự án trong phạm vi này.',
    statsProjectLabel: 'Dự án (nhân viên)',
    allProjectsLink: 'Tất cả dự án của tôi',
  },
};

function dashboardCopyForRole(role: string | undefined): DashboardCopy {
  if (role && DASHBOARD_COPY[role]) return DASHBOARD_COPY[role];
  return DASHBOARD_COPY.EMPLOYEE;
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

export default function Home() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<{ tasks: any[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);
  useSocket(undefined, user?.id);

  const dash = useMemo(() => dashboardCopyForRole(user?.role), [user?.role]);

  const fetchData = useCallback(async () => {
    try {
      const [projectsRes, dashboardRes] = await Promise.all([
        axiosInstance.get('/projects?forDashboard=1'),
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    const hProjectCreated = () => {
      void fetchData();
    };
    const hProjectUpdated = () => {
      void fetchData();
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
  }, [fetchData]);

  /** Thẻ đã lưu trữ không hiển thị trên dashboard (đồng bộ API /tasks/my-tasks và socket). */
  const activeDashboardTasks = useMemo(
    () => (dashboardData?.tasks ?? []).filter((t: any) => !t.archivedAt),
    [dashboardData?.tasks]
  );

  const dashboardProjectIdSet = useMemo(
    () => new Set(projects.map((p) => p.id)),
    [projects]
  );

  /** Thẻ «của tôi» trong các dự án đang hiển thị (giống dashboard trước — không chỉ lọc assignee). */
  const tasksInDashboardScope = useMemo(
    () => activeDashboardTasks.filter((t: any) => dashboardProjectIdSet.has(t.projectId)),
    [activeDashboardTasks, dashboardProjectIdSet]
  );

  const dashboardStats = useMemo(() => {
    const projectCount = projects.length;
    const myTotalTasks = tasksInDashboardScope.length;
    const myCompletedTasks = tasksInDashboardScope.filter((t: any) =>
      ['DONE', 'APPROVED'].includes(t.status)
    ).length;
    const myActiveTasks = Math.max(0, myTotalTasks - myCompletedTasks);
    const overallTotalTasks = Number(dashboardData?.stats?.totalTasks || myTotalTasks || 0);
    const overallCompletedTasks = Number(dashboardData?.stats?.completedTasks || myCompletedTasks || 0);
    const overallActiveTasks = Math.max(
      0,
      Number(dashboardData?.stats?.activeTasks ?? overallTotalTasks - overallCompletedTasks)
    );
    const totalMembers = projects.reduce((sum: number, p: any) => sum + (p?._count?.members ?? 0), 0);
    const avgProjectProgress = projectCount
      ? Math.round(
          projects.reduce((sum: number, p: any) => sum + Number(p?.taskProgress?.percent || 0), 0) / projectCount
        )
      : 0;

    return {
      projectCount,
      overallTotalTasks,
      overallCompletedTasks,
      overallActiveTasks,
      myTotalTasks,
      myCompletedTasks,
      myActiveTasks,
      myCompletionPct: pct(myCompletedTasks, myTotalTasks),
      overallCompletionPct: pct(overallCompletedTasks, overallTotalTasks),
      activeSharePct: pct(overallActiveTasks, overallTotalTasks),
      avgProjectProgress,
      totalMembers,
    };
  }, [projects, tasksInDashboardScope, dashboardData?.stats]);

  const stats = useMemo(
    () => [
      {
        label: 'Tổng dự án',
        value: dashboardStats.projectCount,
        subLabel: 'Đang hoạt động',
        subValue: `${dashboardStats.overallActiveTasks} việc mở`,
        icon: Layers,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
      },
      {
        label: 'Tổng công việc',
        value: dashboardStats.overallTotalTasks,
        subLabel: 'Cá nhân',
        subValue: `${dashboardStats.myTotalTasks} việc của bạn`,
        icon: ListTodo,
        color: 'text-violet-600',
        bg: 'bg-violet-50',
      },
      {
        label: 'Đang thực hiện',
        value: dashboardStats.overallActiveTasks,
        subLabel: 'Tỷ trọng',
        subValue: `${dashboardStats.activeSharePct}% trên tổng việc`,
        icon: Clock,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
      },
      {
        label: 'Hoàn thành',
        value: dashboardStats.overallCompletedTasks,
        subLabel: 'Tỷ lệ tổng',
        subValue: `${dashboardStats.overallCompletionPct}%`,
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
      },
    ],
    [dashboardStats]
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto">
          <div className="min-h-[60vh] flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
            <p className="mt-4 text-sm text-slate-500">Đang tải dữ liệu dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head>
        <title>Bảng điều khiển PMS</title>
      </Head>

      <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <PageHeader 
          title={<>Tổng quan công việc</>}
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
              </div>
              <div className="space-y-1.5">
                <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-500">{stat.subLabel}:</span> {stat.subValue}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Recent Boards (Trello Style Grid) */}
          <section className="lg:col-span-2 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center">
                  <Layout className="h-5 w-5 mr-3 text-emerald-500 shrink-0" />
                  {dash.boardsHeading}
                </h2>
                <p className="mt-1 text-sm text-slate-500 max-w-2xl">{dash.boardsSubline}</p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/projects')}
                className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center transition-colors shrink-0"
              >
                {dash.allProjectsLink} <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              {projects.length > 0 ? (
                projects.map((project: any) => {
                  const myTasksHere = tasksInDashboardScope.filter(
                    (t: any) => t.projectId === project.id
                  );
                  const myDone = myTasksHere.filter((t: any) =>
                    ['DONE', 'APPROVED'].includes(t.status)
                  ).length;
                  const myActive = myTasksHere.filter(
                    (t: any) => !['DONE', 'APPROVED'].includes(t.status)
                  ).length;
                  const myProgressPct = myTasksHere.length
                    ? Math.round((myDone / myTasksHere.length) * 100)
                    : 0;
                  const projectProgressPct = Number(project?.taskProgress?.percent || 0);
                  const projectCompleted = Number(project?.taskProgress?.completed || 0);
                  const projectTotal = Number(project?.taskProgress?.total || 0);
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
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-2 bg-slate-50/90 px-3 py-2.5">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-emerald-800">
                              {project.name}
                            </h3>
                            {project.myProjectRole ? (
                              <span className="mt-1 inline-block rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                                {PROJECT_ROLE_VI[project.myProjectRole] ?? project.myProjectRole}
                              </span>
                            ) : null}
                            <p className="mt-1 text-[10px] font-medium tabular-nums text-slate-500">
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

                      <div className="space-y-2.5 px-3 py-2.5">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="flex gap-2">
                            <UserCircle
                              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Chủ dự án
                              </p>
                              <p className="truncate text-[11px] font-medium text-slate-800">
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
                              <p className="text-[11px] font-medium tabular-nums text-slate-800">
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
                              <p className="text-[11px] font-medium tabular-nums text-slate-800">
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
                              <p className="text-[11px] font-medium tabular-nums text-slate-800">
                                {memberTotal}
                              </p>
                            </div>
                          </div>
                        </div>

                        {descPlain ? (
                          <div className="rounded border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Tóm tắt mô tả
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-700 line-clamp-2">
                              {descPlain}
                            </p>
                          </div>
                        ) : (
                          <p className="rounded border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2 text-xs italic text-slate-400">
                            Chưa có mô tả dự án.
                          </p>
                        )}

                        <div className="border-t border-slate-100 pt-2.5 space-y-2">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                              <span className="font-medium text-slate-700">Tiến độ dự án</span>
                              <span className="tabular-nums text-slate-500">
                                <span className="font-semibold text-emerald-700">{projectProgressPct}%</span>
                                <span className="text-slate-400"> ({projectCompleted}/{projectTotal})</span>
                              </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-600 transition-all"
                                style={{ width: `${projectProgressPct}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                              <span className="font-medium text-slate-700">Tiến độ cá nhân</span>
                              <span className="tabular-nums text-slate-500">
                                <span className="font-semibold text-blue-700">{myProgressPct}%</span>
                                <span className="text-slate-400"> ({myDone}/{myTasksHere.length})</span>
                              </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-blue-600 transition-all"
                                style={{ width: `${myProgressPct}%` }}
                              />
                            </div>
                            {myTasksHere.length === 0 ? (
                              <p className="mt-1 text-[10px] text-slate-400">
                                Chưa có thẻ cá nhân trong dự án này.
                              </p>
                            ) : (
                              <p className="mt-1 text-[10px] text-slate-400">
                                {myActive} đang xử lý · {myDone} hoàn thành
                              </p>
                            )}
                          </div>
                        </div>
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
                  <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{dash.emptyGrid}</p>
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
                {tasksInDashboardScope.length > 0 ? (
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
                      {tasksInDashboardScope.slice(0, 20).map((task: any) => {
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Tổng quan</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tập trung vào hiệu suất tổng thể và tiến độ cá nhân.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Toàn bộ dự án</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <p><span className="font-semibold text-slate-800">{dashboardStats.projectCount}</span> dự án</p>
                    <p><span className="font-semibold text-slate-800">{dashboardStats.overallTotalTasks}</span> thẻ</p>
                    <p><span className="font-semibold text-amber-700">{dashboardStats.overallActiveTasks}</span> đang xử lý</p>
                    <p><span className="font-semibold text-emerald-700">{dashboardStats.overallCompletedTasks}</span> đã xong</p>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>Tỷ lệ hoàn thành tổng</span>
                      <span className="font-semibold text-emerald-700">{dashboardStats.overallCompletionPct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${dashboardStats.overallCompletionPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Hiệu suất cá nhân</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <p><span className="font-semibold text-slate-800">{dashboardStats.myTotalTasks}</span> thẻ của tôi</p>
                    <p><span className="font-semibold text-blue-700">{dashboardStats.myCompletedTasks}</span> hoàn thành</p>
                    <p><span className="font-semibold text-amber-700">{dashboardStats.myActiveTasks}</span> đang xử lý</p>
                    <p><span className="font-semibold text-violet-700">{dashboardStats.avgProjectProgress}%</span> TB tiến độ dự án</p>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>Tỷ lệ hoàn thành cá nhân</span>
                      <span className="font-semibold text-blue-700">{dashboardStats.myCompletionPct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${dashboardStats.myCompletionPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </MainLayout>
  );
}
