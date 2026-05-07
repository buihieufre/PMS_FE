import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import axiosInstance from '@/lib/axios';
import { Plus, Eye, Pencil, Trash2, Search, MoreVertical, Link2, Copy, Ban } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/Layout/PageHeader';
import ConfirmModal from '@/components/Modal/ConfirmModal';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import {
  canCreateProjects,
  canEditProject,
  canDeleteProject,
  canManageCustomerShareLinks,
} from '@/lib/permissions';

interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  owner?: { id: string; displayName: string };
  createdAt: string;
  myProjectRole?: string | null;
}

interface ShareLinkItem {
  id: string;
  expiresAt: string;
  isRevoked: boolean;
  shareUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useAuthStore() as { user: any };
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [shareModalProject, setShareModalProject] = useState<Project | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLinkItem[]>([]);
  const [loadingShareLinks, setLoadingShareLinks] = useState(false);
  const [creatingShareLink, setCreatingShareLink] = useState(false);

  const fetchProjects = async () => {
    try {
      const response = await axiosInstance.get('/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
      toast.error('Không thể tải danh sách dự án');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, ownerFilter, sortBy, pageSize]);

  const handleDelete = async () => {
    if (!projectToDelete) return;
    try {
      await axiosInstance.delete(`/projects/${projectToDelete}`);
      toast.success('Dự án đã được xóa thành công');
      setProjectToDelete(null);
      fetchProjects();
    } catch (err) {
      toast.error('Xóa dự án thất bại');
    }
  };


  const openShareLinkModal = async (project: Project) => {
    setShareModalProject(project);
    setShareLinks([]);
    setLoadingShareLinks(true);
    try {
      const res = await axiosInstance.get(`/projects/${project.id}/share-links`);
      setShareLinks(res.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Không tải được danh sách link chia sẻ');
    } finally {
      setLoadingShareLinks(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!shareModalProject) return;
    setCreatingShareLink(true);
    try {
      const res = await axiosInstance.post(`/projects/${shareModalProject.id}/share-links`);
      const shareUrl = res.data?.shareUrl;
      if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
      }
      toast.success('Đã tạo link và copy vào clipboard');
      await openShareLinkModal(shareModalProject);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Không tạo được link chia sẻ');
    } finally {
      setCreatingShareLink(false);
    }
  };

  const handleCopyShareLink = async (link: ShareLinkItem) => {
    const fallbackUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/shared/project/${link.id}` : '';
    const url = link.shareUrl || fallbackUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success('Đã copy link');
  };

  const handleRevokeShareLink = async (linkId: string) => {
    if (!shareModalProject) return;
    try {
      await axiosInstance.patch(`/projects/${shareModalProject.id}/share-links/${linkId}/revoke`);
      toast.success('Đã thu hồi link');
      await openShareLinkModal(shareModalProject);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Không thu hồi được link');
    }
  };

  const getPreviewText = (desc: string) => {
    if (!desc) return '';
    try {
      const data = JSON.parse(desc);
      if (data.blocks && data.blocks.length > 0) {
        const pBlock = data.blocks.find((b: any) => b.type === 'paragraph');
        // Strip out simple HTML tags that EditorJS might produce
        return pBlock ? pBlock.data.text.replace(/<[^>]*>?/gm, '') : 'Mô tả chi tiết...';
      }
      return 'Không có mô tả';
    } catch {
      return desc;
    }
  };

  const ownerOptions = useMemo(() => {
    const owners = new Map<string, string>();
    projects.forEach((project) => {
      if (project.owner?.id) owners.set(project.owner.id, project.owner.displayName || '—');
    });
    return Array.from(owners.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const next = projects.filter((project) => {
      const matchOwner = ownerFilter === 'all' || project.owner?.id === ownerFilter;
      if (!matchOwner) return false;
      if (!keyword) return true;
      const haystack = [
        project.name,
        getPreviewText(project.description),
        project.owner?.displayName || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });

    next.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? tb - ta : ta - tb;
    });
    return next;
  }, [projects, searchTerm, ownerFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!openMenuProjectId) return;
    const closeMenu = () => {
      setOpenMenuProjectId(null);
      setMenuAnchor(null);
    };
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [openMenuProjectId]);

  return (
    <>
      <Head>
        <title>Quản lý dự án | PMS</title>
      </Head>
      <MainLayout>
      <PageHeader 
        title="Dự án"
        description="Quản lý tất cả các dự án đang hoạt động và đã qua."
        actions={
          canCreateProjects(user) ? (
            <button
              type="button"
              onClick={() => router.push('/projects/new')}
              className="flex items-center px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tạo dự án mới
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên dự án, mô tả, người tạo..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">Tất cả người tạo</option>
          {ownerOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-700">
              <tr>
                <th className="px-6 py-4">Tên dự án</th>
                <th className="px-6 py-4">Mô tả</th>
                <th className="px-6 py-4">Người tạo</th>
                <th className="px-6 py-4">Ngày tạo</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Đang tải danh sách dự án...</td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Không có dự án phù hợp với điều kiện tìm kiếm/lọc.</td>
                </tr>
              ) : (
                paginatedProjects.map((project) => (
                  <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <Link href={`/projects/${project.id}`} className="hover:underline">
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{getPreviewText(project.description)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-800">
                      {project.owner?.displayName ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            if (openMenuProjectId === project.id) {
                              setOpenMenuProjectId(null);
                              setMenuAnchor(null);
                              return;
                            }
                            setOpenMenuProjectId(project.id);
                            setMenuAnchor({ top: rect.top, left: rect.right });
                          }}
                          className="p-1.5 text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                          title="Thao tác"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuProjectId === project.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => {
                                setOpenMenuProjectId(null);
                                setMenuAnchor(null);
                              }}
                            />
                            <div
                              className="fixed z-20 min-w-[12rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
                              style={{
                                top: menuAnchor?.top ?? 0,
                                left: menuAnchor?.left ?? 0,
                                transform: 'translate(calc(-100%), calc(-100% - 8px))',
                              }}
                            >
                              <Link
                                href={`/projects/${project.id}/info`}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setOpenMenuProjectId(null);
                                  setMenuAnchor(null);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                Xem thông tin
                              </Link>
                              {canEditProject(user, project) && (
                                <Link
                                  href={`/projects/${project.id}/edit`}
                                  className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    setOpenMenuProjectId(null);
                                    setMenuAnchor(null);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                  Chỉnh sửa
                                </Link>
                              )}
                              {canDeleteProject(user, project) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProjectToDelete(project.id);
                                    setOpenMenuProjectId(null);
                                    setMenuAnchor(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  Xóa dự án
                                </button>
                              )}
                              {canManageCustomerShareLinks(user, project) && (
                                <>
                                  <div className="my-1 border-t border-slate-100" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuProjectId(null);
                                      setMenuAnchor(null);
                                      openShareLinkModal(project);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                  >
                                    <Link2 className="h-3.5 w-3.5 text-slate-500" />
                                    Chia sẻ khách hàng
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && filteredProjects.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Hiển thị {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredProjects.length)} trên {filteredProjects.length} dự án
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value={5}>5 / trang</option>
              <option value={10}>10 / trang</option>
              <option value={20}>20 / trang</option>
            </select>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Trước
            </button>
            <span className="text-sm text-slate-600 px-1">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </MainLayout>
      <ConfirmModal
        isOpen={!!projectToDelete}
        title="Xóa dự án"
        description="Bạn có chắc chắn muốn xóa dự án này? Hành động này không thể hoàn tác."
        onConfirm={handleDelete}
        onCancel={() => setProjectToDelete(null)}
      />
      {shareModalProject && (
        <div className="fixed inset-0 z-[20000]">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShareModalProject(null)} />
          <div className="relative mx-auto mt-20 w-[95%] max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Chia sẻ khách hàng — {shareModalProject.name}</h3>
              <button type="button" onClick={() => setShareModalProject(null)} className="text-sm text-slate-500 hover:text-slate-700">Đóng</button>
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Tạo và quản lý link chỉ xem (30 ngày).</p>
                <button
                  type="button"
                  onClick={handleCreateShareLink}
                  disabled={creatingShareLink || !shareModalProject}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {creatingShareLink ? 'Đang tạo...' : 'Tạo link 30 ngày'}
                </button>
              </div>
              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {loadingShareLinks ? (
                  <p className="text-xs text-slate-500">Đang tải danh sách link...</p>
                ) : shareLinks.length === 0 ? (
                  <p className="text-xs italic text-slate-400">Chưa có link chia sẻ.</p>
                ) : (
                  shareLinks.map((link) => {
                    const expired = new Date(link.expiresAt).getTime() < Date.now();
                    const statusLabel = link.isRevoked ? 'Đã thu hồi' : expired ? 'Đã hết hạn' : 'Đang hiệu lực';
                    return (
                      <div key={link.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-slate-700">{statusLabel}</p>
                          <p className="text-[11px] text-slate-400">
                            Hết hạn: {new Date(link.expiresAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyShareLink(link)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-white"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </button>
                          {!link.isRevoked && (
                            <button
                              type="button"
                              onClick={() => handleRevokeShareLink(link.id)}
                              className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                            >
                              <Ban className="h-3 w-3" />
                              Thu hồi
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
