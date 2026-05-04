import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { Lock, MessageSquare, CalendarClock, UserRound } from 'lucide-react';
import { parseTaskDescriptionData } from '@/lib/taskDescription';

function editorJsToReadableText(raw: string | null | undefined): string {
  if (!raw || !String(raw).trim()) return '';
  const parsed = parseTaskDescriptionData(raw);
  const lines: string[] = [];

  for (const block of parsed.blocks || []) {
    const d = block?.data || {};
    if (typeof d.text === 'string' && d.text.trim()) {
      lines.push(d.text.replace(/<[^>]+>/g, '').trim());
      continue;
    }
    if (block?.type === 'list' && Array.isArray(d.items)) {
      for (const item of d.items) {
        const itemText =
          typeof item === 'string'
            ? item
            : typeof item?.content === 'string'
              ? item.content
              : '';
        if (itemText.trim()) lines.push(`- ${itemText.replace(/<[^>]+>/g, '').trim()}`);
      }
      continue;
    }
    if (block?.type === 'checklist' && Array.isArray(d.items)) {
      for (const item of d.items) {
        const t = String(item?.text || '').replace(/<[^>]+>/g, '').trim();
        if (t) lines.push(`- ${t}`);
      }
      continue;
    }
    if (block?.type === 'code' && typeof d.code === 'string' && d.code.trim()) {
      lines.push(d.code.trim());
    }
  }

  return lines.join('\n').trim();
}

export default function SharedProjectPage() {
  const router = useRouter();
  const { token } = router.query as { token?: string };
  const [loading, setLoading] = useState(true);
  const [projectData, setProjectData] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [projectRes, feedbackRes] = await Promise.all([
        axiosInstance.get(`/public/projects/${token}`),
        axiosInstance.get(`/public/projects/${token}/feedbacks`)
      ]);
      setProjectData(projectRes.data);
      setFeedbacks(feedbackRes.data?.feedbacks || []);
      setCreatedAt(projectRes.data?.link?.createdAt || null);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Link không hợp lệ hoặc đã hết hạn');
      setProjectData(null);
    } finally {
      setLoading(false);
    }
  };

  const progress = Number(projectData?.project?.progress?.percent || 0);
  const plannedPercentRaw = projectData?.project?.timeline?.plannedPercent;
  const plannedPercent =
    typeof plannedPercentRaw === 'number' ? Math.max(0, Math.min(100, plannedPercentRaw)) : null;
  const actualPercent = Math.max(0, Math.min(100, Number(projectData?.project?.timeline?.actualPercent ?? progress)));
  const readableDescription = editorJsToReadableText(projectData?.project?.description);

  useEffect(() => {
    if (router.isReady && token) void fetchData();
  }, [router.isReady, token]);

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) {
      toast.error('Vui lòng nhập tên và nội dung');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      await axiosInstance.post(`/public/projects/${token}/feedbacks`, {
        authorName: authorName.trim(),
        content: content.trim()
      });
      setContent('');
      toast.success('Đã gửi feedback');
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Không gửi được feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>{projectData?.project?.name ? `${projectData.project.name} | PMS` : 'Chia sẻ dự án | PMS'}</title>
      </Head>
      <div className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-700">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Chế độ chỉ xem</span>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Link chia sẻ khách hàng
              </span>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Đang tải dữ liệu dự án...
            </div>
          ) : !projectData?.project ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-700 shadow-sm">
              Link không hợp lệ, đã thu hồi hoặc đã hết hạn.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">{projectData.project.name}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      Chủ dự án: <span className="font-medium text-slate-800">{projectData.project.owner?.displayName || '—'}</span>
                    </div>
                    {createdAt && (
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-slate-400" />
                        Chia sẻ từ: {new Date(createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-medium text-slate-700">Tiến độ dự án</p>
                      <p className="text-xl font-semibold text-slate-900">{progress}%</p>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-700 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {projectData.project.progress?.completed || 0} / {projectData.project.progress?.total || 0} công việc đã hoàn thành
                    </p>
                  </div>

                  <div className="mt-5">
                    <h2 className="text-sm font-medium text-slate-700">Mô tả dự án</h2>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                      {readableDescription || 'Không có mô tả'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-slate-500" />
                    <h2 className="text-base font-semibold text-slate-800">Gửi phản hồi</h2>
                  </div>
                  <form onSubmit={submitFeedback} className="space-y-3">
                    <input
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Tên của bạn"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                    />
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Nội dung phản hồi..."
                      className="min-h-[110px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
                    >
                      {submitting ? 'Đang gửi...' : 'Gửi phản hồi'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-800">Thống kê nhanh</h2>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Tổng công việc</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{projectData.project.progress?.total || 0}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Đã hoàn thành</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{projectData.project.progress?.completed || 0}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Tiến độ hiện tại</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{progress}%</p>
                  </div>
                </div>
              </div>

              {plannedPercent != null && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-800">Theo dõi theo thời gian</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Biểu đồ Dự kiến vs Thực tế để đánh giá hiệu suất triển khai.
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">Dự kiến</span>
                        <span className="font-semibold text-slate-800">{plannedPercent}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-slate-500 transition-all"
                          style={{ width: `${plannedPercent}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">Thực tế</span>
                        <span className="font-semibold text-slate-800">{actualPercent}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all"
                          style={{ width: `${actualPercent}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {actualPercent >= plannedPercent
                        ? 'Hiệu suất đang đạt hoặc vượt so với kế hoạch.'
                        : 'Hiệu suất đang chậm hơn kế hoạch, cần theo dõi thêm.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <h2 className="text-base font-semibold text-slate-800">Phản hồi gần đây</h2>
                <div className="mt-4 space-y-3">
                  {feedbacks.length === 0 ? (
                    <p className="text-sm text-slate-500">Chưa có phản hồi nào.</p>
                  ) : (
                    feedbacks.map((fb) => (
                      <div key={fb.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800">{fb.authorName}</p>
                          <p className="text-xs text-slate-500">{new Date(fb.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{fb.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
