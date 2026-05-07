import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MainLayout from '@/components/Layout/MainLayout';
import { PageHeader } from '@/components/Layout/PageHeader';
import axiosInstance from '@/lib/axios';
import { BarChart3, Download, ArrowLeft, Users, LineChart, PieChart, Trophy } from 'lucide-react';
import { toast } from 'sonner';

type Project = {
  id: string;
  name: string;
  createdAt?: string;
  owner?: { displayName?: string };
  taskProgress?: { total?: number; completed?: number; percent?: number };
  _count?: { members?: number; tasks?: number };
};

const DONE_STATUSES = new Set(['DONE', 'APPROVED']);

export default function ProjectReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, tasksRes] = await Promise.all([
          axiosInstance.get('/projects'),
          axiosInstance.get('/tasks/my-tasks'),
        ]);
        setProjects(projectsRes.data || []);
        setTasks(tasksRes.data?.tasks || []);
      } catch (error) {
        console.error(error);
        toast.error('Không thể tải dữ liệu báo cáo');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const statusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      const key = t.status || 'UNKNOWN';
      counts[key] = (counts[key] || 0) + 1;
    }
    const labels: Record<string, string> = {
      PENDING: 'Chờ xử lý',
      IN_PROGRESS: 'Đang thực hiện',
      WAITING_FOR_DOCUMENT: 'Chờ tài liệu',
      DELAYED: 'Trễ hạn',
      DONE: 'Hoàn thành',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Từ chối',
      UNKNOWN: 'Khác',
    };
    return Object.entries(counts)
      .map(([k, v]) => ({ key: k, label: labels[k] || k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  const overview = useMemo(() => {
    const totalProjects = projects.length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => DONE_STATUSES.has(t.status)).length;
    const activeTasks = Math.max(0, totalTasks - completedTasks);
    const completionPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { totalProjects, totalTasks, completedTasks, activeTasks, completionPct };
  }, [projects, tasks]);

  const projectRows = useMemo(() => {
    return projects
      .map((p) => ({
        id: p.id,
        name: p.name,
        owner: p.owner?.displayName || '—',
        total: Number(p.taskProgress?.total || p._count?.tasks || 0),
        completed: Number(p.taskProgress?.completed || 0),
        percent: Number(p.taskProgress?.percent || 0),
        members: Number(p._count?.members || 0),
      }))
      .sort((a, b) => b.percent - a.percent);
  }, [projects]);

  const projectTaskLoad = useMemo(() => {
    const byProject: Record<string, { name: string; total: number; done: number }> = {};
    for (const task of tasks) {
      const pid = task.projectId || 'unknown';
      const pname = task.project?.name || 'Không rõ dự án';
      if (!byProject[pid]) byProject[pid] = { name: pname, total: 0, done: 0 };
      byProject[pid].total += 1;
      if (DONE_STATUSES.has(task.status)) byProject[pid].done += 1;
    }
    return Object.entries(byProject)
      .map(([id, v]) => ({
        id,
        name: v.name,
        total: v.total,
        done: v.done,
        pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [tasks]);

  const monthlyProjectTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      if (!p.createdAt) continue;
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, v]) => {
        const [y, m] = k.split('-');
        return { key: k, label: `T${m}/${y.slice(2)}`, value: v };
      });
  }, [projects]);

  const ownerLeaderboard = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      const owner = p.owner?.displayName || 'Không rõ';
      map.set(owner, (map.get(owner) || 0) + 1);
    }
    return [...map.entries()]
      .map(([owner, total]) => ({ owner, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [projects]);

  const memberDistribution = useMemo(() => {
    const buckets = [
      { key: '1-3', label: '1-3 thành viên', count: 0 },
      { key: '4-7', label: '4-7 thành viên', count: 0 },
      { key: '8-12', label: '8-12 thành viên', count: 0 },
      { key: '13+', label: '13+ thành viên', count: 0 },
    ];
    for (const p of projects) {
      const n = Number(p._count?.members || 0);
      if (n <= 3) buckets[0].count += 1;
      else if (n <= 7) buckets[1].count += 1;
      else if (n <= 12) buckets[2].count += 1;
      else buckets[3].count += 1;
    }
    return buckets;
  }, [projects]);

  const progressBands = useMemo(() => {
    const bands = [
      { key: '0-25', label: '0-25%', count: 0 },
      { key: '26-50', label: '26-50%', count: 0 },
      { key: '51-75', label: '51-75%', count: 0 },
      { key: '76-100', label: '76-100%', count: 0 },
    ];
    for (const p of projectRows) {
      const pct = Number(p.percent || 0);
      if (pct <= 25) bands[0].count += 1;
      else if (pct <= 50) bands[1].count += 1;
      else if (pct <= 75) bands[2].count += 1;
      else bands[3].count += 1;
    }
    return bands;
  }, [projectRows]);

  const exportCsv = () => {
    const lines = [
      'Bao cao du an PMS',
      `Tong du an,${overview.totalProjects}`,
      `Tong cong viec,${overview.totalTasks}`,
      `Cong viec hoan thanh,${overview.completedTasks}`,
      `Ty le hoan thanh,${overview.completionPct}%`,
      '',
      'Danh sach du an',
      'Ten du an,Chu du an,Tong viec,Da hoan thanh,Tien do %,Thanh vien',
      ...projectRows.map((r) =>
        `"${String(r.name).replace(/"/g, '""')}","${String(r.owner).replace(/"/g, '""')}",${r.total},${r.completed},${r.percent},${r.members}`
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-du-an-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file báo cáo');
  };

  return (
    <MainLayout>
      <Head>
        <title>Báo cáo dự án | PMS</title>
      </Head>
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Báo cáo dự án"
          description="Theo dõi tổng quan hiệu suất dự án và công việc."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại dashboard
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                Xuất file CSV
              </button>
            </div>
          }
        />

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Đang tải báo cáo...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Tổng dự án" value={overview.totalProjects} />
              <StatCard label="Tổng công việc" value={overview.totalTasks} />
              <StatCard label="Đang xử lý" value={overview.activeTasks} />
              <StatCard label="Hoàn thành" value={`${overview.completionPct}%`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Biểu đồ trạng thái công việc
                </h3>
                <div className="mt-4 space-y-2">
                  {statusChart.length === 0 ? (
                    <p className="text-sm text-slate-500">Chưa có dữ liệu công việc.</p>
                  ) : (
                    statusChart.map((s) => {
                      const max = statusChart[0]?.value || 1;
                      const width = Math.max(8, Math.round((s.value / max) * 100));
                      return (
                        <div key={s.key}>
                          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                            <span>{s.label}</span>
                            <span className="font-semibold">{s.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900">Tiến độ theo dự án</h3>
                <div className="mt-4 space-y-3 max-h-[320px] overflow-auto pr-1">
                  {projectRows.length === 0 ? (
                    <p className="text-sm text-slate-500">Chưa có dữ liệu dự án.</p>
                  ) : (
                    projectRows.map((p) => (
                      <div key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                          <p className="text-emerald-700 font-bold">{p.percent}%</p>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {p.owner} · {p.completed}/{p.total} công việc
                        </p>
                        <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.max(0, Math.min(100, p.percent))}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-blue-600" />
                  Xu hướng tạo dự án (6 tháng gần nhất)
                </h3>
                <div className="mt-4 space-y-2">
                  {monthlyProjectTrend.length === 0 ? (
                    <p className="text-sm text-slate-500">Chưa đủ dữ liệu thời gian dự án.</p>
                  ) : (
                    monthlyProjectTrend.map((m) => {
                      const max = monthlyProjectTrend.reduce((acc, x) => Math.max(acc, x.value), 1);
                      const width = Math.max(10, Math.round((m.value / max) * 100));
                      return (
                        <div key={m.key}>
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                            <span>{m.label}</span>
                            <span className="font-semibold">{m.value} dự án</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-600" />
                  Top chủ dự án
                </h3>
                <div className="mt-4 space-y-2">
                  {ownerLeaderboard.length === 0 ? (
                    <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
                  ) : (
                    ownerLeaderboard.map((o, idx) => (
                      <div key={`${o.owner}-${idx}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{o.owner}</p>
                        <p className="text-xs text-slate-500">{o.total} dự án</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-violet-600" />
                  Phân bố quy mô thành viên
                </h3>
                <div className="mt-4 space-y-2">
                  {memberDistribution.map((b) => {
                    const max = Math.max(...memberDistribution.map((x) => x.count), 1);
                    const width = Math.max(6, Math.round((b.count / max) * 100));
                    return (
                      <div key={b.key}>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                          <span>{b.label}</span>
                          <span className="font-semibold">{b.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-violet-600 rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  Phân bố tiến độ dự án
                </h3>
                <div className="mt-4 space-y-2">
                  {progressBands.map((b) => {
                    const max = Math.max(...progressBands.map((x) => x.count), 1);
                    const width = Math.max(6, Math.round((b.count / max) * 100));
                    return (
                      <div key={b.key}>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                          <span>{b.label}</span>
                          <span className="font-semibold">{b.count} dự án</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-900">Khối lượng công việc theo dự án (Top 8)</h3>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {projectTaskLoad.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có dữ liệu công việc theo dự án.</p>
                ) : (
                  projectTaskLoad.map((p) => (
                    <div key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm gap-2">
                        <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                        <p className="text-blue-700 font-bold">{p.total} việc</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Đã xong: {p.done} · Tỷ lệ: {p.pct}%</p>
                      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
