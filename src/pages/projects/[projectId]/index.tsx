import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { ArrowLeft, Info, Plus, Trash2, MoreVertical, Search as SearchIcon, Edit2, LayoutDashboard, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { PageHeader } from '@/components/Layout/PageHeader';
import ManageMemberModal from '@/components/Modal/ManageMemberModal';
import DashboardCalendar from '@/components/Dashboard/DashboardCalendar';
import { parseTaskDescriptionData } from '@/lib/taskDescription';

interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  projectAttachments?: { id: string; fileUrl: string; fileName: string }[];
  myProjectRole?: string | null;
  owner: {
    id: string;
    displayName: string;
    email: string;
    departmentId?: string;
  };
}

export default function ProjectDashboard() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };
  const { user } = useAuthStore() as { user: any };

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isProjectDetailModalOpen, setIsProjectDetailModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!projectId) return;
    try {
      const pRes = await axiosInstance.get(`/projects/${projectId}`);
      setProject(pRes.data);

      const [tasksRes, membersRes] = await Promise.allSettled([
        axiosInstance.get(`/projects/${projectId}/tasks`),
        axiosInstance.get(`/projects/${projectId}/members`)
      ]);

      if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data);
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value.data);
    } catch (error) {
      console.error('Không thể tải dữ liệu tổng quan dự án', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi dự án?')) return;
    try {
      await axiosInstance.delete(`/projects/${projectId}/members/${userId}`);
      toast.success('Đã xóa thành viên');
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Không thể xóa thành viên');
    }
  };

  const myRoleFromMembers = useMemo(
    () =>
      members.find((m: any) => m.userId === user?.id || m.user?.id === user?.id)
        ?.projectRole ?? null,
    [members, user?.id]
  );
  const effectiveMyProjectRole = project?.myProjectRole ?? myRoleFromMembers;

  const isSystemAdmin = user?.role === 'ADMIN';
  const canManageMembers =
    isSystemAdmin || effectiveMyProjectRole === 'PROJECT_OWNER';
  const canCreateTasks =
    isSystemAdmin ||
    effectiveMyProjectRole === 'PROJECT_OWNER' ||
    effectiveMyProjectRole === 'TEAM_LEAD';

  useEffect(() => {
    if (router.isReady && projectId) {
      fetchDashboardData();
    }
  }, [router.isReady, projectId]);

  const projectDescriptionText = useMemo(() => {
    if (!project?.description) return '';
    const parsed = parseTaskDescriptionData(project.description);
    const lines: string[] = [];
    for (const block of parsed.blocks || []) {
      const d = block?.data || {};
      if (typeof d.text === 'string' && d.text.trim()) {
        lines.push(d.text.replace(/<[^>]+>/g, '').trim());
        continue;
      }
      if (block?.type === 'list' && Array.isArray(d.items)) {
        for (const item of d.items) {
          const text =
            typeof item === 'string' ? item : typeof item?.content === 'string' ? item.content : '';
          if (text.trim()) lines.push(`- ${text.replace(/<[^>]+>/g, '').trim()}`);
        }
      }
    }
    return lines.join('\n').trim();
  }, [project?.description]);

  // Thống kê nhanh theo dữ liệu dự án
  const stats = useMemo(() => {
    const total = tasks.length;
    const approved = tasks.filter(t => t.status === 'APPROVED' || t.status === 'DONE').length;
    const pending = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;
    return { total, APPROVED: approved, PENDING: pending };
  }, [tasks]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.user.displayName.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      m.user.email.toLowerCase().includes(memberSearchTerm.toLowerCase())
    );
  }, [members, memberSearchTerm]);

  return (
    <MainLayout>
      <Head>
        <title>{project ? `${project.name} | PMS` : 'Dự án | PMS'}</title>
      </Head>
      <div className="flex flex-col h-full bg-slate-50 min-h-[calc(100vh-64px)]">
        <PageHeader 
          title={project ? project.name : 'Đang tải dự án...'}
          description="Xem thống kê dự án, quản lý thành viên và theo dõi tiến độ."
          breadcrumbs={
            <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest gap-2">
              <Link href="/projects" className="hover:text-emerald-500 transition-colors">Dự án</Link>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600">Chi tiết</span>
            </div>
          }
          actions={
            <div className="flex items-center gap-3">
              <Link 
                href={`/projects/${projectId}/board`}
                className="px-6 py-2.5 text-sm font-bold bg-slate-900 text-white rounded-xl shadow-lg hover:shadow-slate-200 transition-all flex items-center active:scale-95"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Mở bảng công việc
              </Link>
               {canCreateTasks && (
                 <button 
                   onClick={() => setIsProjectDetailModalOpen(true)}
                   className="px-6 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center active:scale-95"
                 >
                   <FileText className="h-4 w-4 mr-2" />
                   Mô tả chi tiết
                 </button>
               )}
            </div>
          }
        />

        {/* Dynamic Split Layout */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-white/50 rounded-xl border border-slate-200 border-dashed">
               <div className="flex flex-col items-center space-y-3">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-slate-400">Đang tải không gian làm việc...</span>
               </div>
            </div>
          ) : project ? (
            <>
              {/* Member List (Left Sidebar - Narrow) */}
              <div className="w-64 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm shrink-0 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Đội ngũ dự án</h3>
                  {canManageMembers && (
                    <button 
                      onClick={() => {
                        setSelectedMember(null);
                        setIsMemberModalOpen(true);
                      }}
                      className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-emerald-500 transition-all"
                      title="Thêm thành viên"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
                
                {/* Member Search */}
                <div className="px-4 py-3 border-b border-slate-50">
                  <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Tìm thành viên..." 
                      value={memberSearchTerm}
                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-lg text-xs outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                   {filteredMembers.map(member => (
                     <div key={member.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors group relative">
                        <div className="flex items-center min-w-0">
                          <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100 mr-3 shrink-0">
                             <img src={`https://ui-avatars.com/api/?name=${member.user.displayName}&background=random`} alt={member.user.displayName} />
                          </div>
                          <div className="min-w-0">
                             <p className="text-xs font-bold text-slate-800 truncate">{member.user.displayName}</p>
                             <p className="text-[10px] text-slate-400 truncate tracking-tight">{member.projectRole}</p>
                          </div>
                        </div>

                        {canManageMembers && (
                          <div className="relative flex items-center">
                            <button 
                              onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-white rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>

                            {activeMenuId === member.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                                <div className="absolute right-0 top-full mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                                   <button
                                     type="button"
                                     onClick={() => {
                                       setSelectedMember(member);
                                       setIsMemberModalOpen(true);
                                       setActiveMenuId(null);
                                     }}
                                     className="w-full text-left px-3 py-2 text-[10px] text-slate-700 hover:bg-slate-50 flex items-center"
                                   >
                                     <Edit2 className="h-3 w-3 mr-2 text-slate-400 shrink-0" /> Đổi vai trò
                                   </button>
                                   {member.user.id !== project.ownerId && (
                                     <button 
                                       type="button"
                                       onClick={() => {
                                         handleDeleteMember(member.user.id);
                                         setActiveMenuId(null);
                                       }}
                                       className="w-full text-left px-3 py-2 text-[10px] text-red-600 hover:bg-red-50 flex items-center"
                                     >
                                       <Trash2 className="h-3 w-3 mr-2 text-red-400 shrink-0" /> Xóa thành viên
                                     </button>
                                   )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                     </div>
                   ))}
                   
                   {filteredMembers.length === 0 && (
                     <div className="p-8 text-center text-[10px] text-slate-400 italic">
                       {memberSearchTerm ? 'Không tìm thấy kết quả' : 'Chưa có thành viên'}
                     </div>
                   )}
                </div>
              </div>

              {/* Calendar (Right - Largest possible) */}
              <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0">
                 <DashboardCalendar 
                   tasks={tasks} 
                   onTaskClick={(task) => router.push(`/projects/${projectId}/board?taskId=${task.id}`)}
                 />
              </div>
            </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl border-dashed">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                   <Info className="h-8 w-8 text-rose-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Không tìm thấy dự án</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-xs text-center">Chúng tôi không thể định vị dự án này. Dự án có thể đã bị xóa hoặc bạn không có quyền truy cập.</p>
                <Link href="/projects" className="mt-6 text-emerald-600 font-bold hover:underline flex items-center">
                   <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại danh sách dự án
                </Link>
             </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {project && (
        <>
          <ManageMemberModal
            isOpen={isMemberModalOpen}
            onClose={() => {
              setIsMemberModalOpen(false);
              setSelectedMember(null);
            }}
            projectId={projectId}
            departmentId={project.owner.departmentId}
            existingMember={selectedMember}
            onSuccess={fetchDashboardData}
          />
        </>
      )}
      {isProjectDetailModalOpen && project && (
        <div className="fixed inset-0 z-[20000]">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setIsProjectDetailModalOpen(false)} />
          <div className="relative mx-auto mt-16 w-[95%] max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Mô tả chi tiết và tệp đính kèm</h3>
              <button
                type="button"
                onClick={() => setIsProjectDetailModalOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Đóng
              </button>
            </div>
            <div className="mt-4 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mô tả dự án</p>
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                  {projectDescriptionText || 'Không có mô tả'}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tệp đính kèm</p>
                {project.projectAttachments && project.projectAttachments.length > 0 ? (
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {project.projectAttachments.map((att) => {
                      const ext = att.fileName.split('.').pop()?.toLowerCase();
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                      return (
                        <a
                          key={att.id}
                          href={att.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300"
                        >
                          <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                            {isImage ? <ImageIcon className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{att.fileName}</p>
                            <p className="text-[11px] text-slate-400">{ext || 'TỆP'}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Không có tệp đính kèm.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

function PlusIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14m-7-7v14" />
    </svg>
  );
}
