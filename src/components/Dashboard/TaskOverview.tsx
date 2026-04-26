import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, PlayCircle, FileText, Ban } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import Link from 'next/link';
import { taskTitleToPlainText } from '@/lib/taskDescription';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  projectId: string;
  project: { name: string };
  dueDate?: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string; border: string }> = {
  PENDING: { 
    color: 'text-amber-600', 
    bg: 'bg-amber-50', 
    border: 'border-amber-200',
    icon: Clock, 
    label: 'Chưa thực hiện' 
  },
  IN_PROGRESS: { 
    color: 'text-blue-600', 
    bg: 'bg-blue-50', 
    border: 'border-blue-200',
    icon: PlayCircle, 
    label: 'Đang làm dở' 
  },
  WAITING_FOR_DOCUMENT: { 
    color: 'text-orange-600', 
    bg: 'bg-orange-50', 
    border: 'border-orange-200',
    icon: FileText, 
    label: 'Đang hoàn thiện' 
  },
  DONE: { 
    color: 'text-teal-600', 
    bg: 'bg-teal-50', 
    border: 'border-teal-200',
    icon: CheckCircle2, 
    label: 'Hoàn thiện' 
  },
  APPROVED: { 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-50', 
    border: 'border-emerald-200',
    icon: CheckCircle2, 
    label: 'Hoàn thành' 
  },
  REJECTED: { 
    color: 'text-red-700', 
    bg: 'bg-red-50', 
    border: 'border-red-200',
    icon: Ban, 
    label: 'Từ chối' 
  },
  DELAYED: { 
    color: 'text-rose-600', 
    bg: 'bg-rose-50', 
    border: 'border-rose-200',
    icon: AlertCircle, 
    label: 'Bị chậm' 
  },
};

export default function TaskOverview() {
  const [data, setData] = useState<{ tasks: Task[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get('/tasks/my-tasks')
      .then(res => setData(res.data))
      .catch(err => console.error('Failed to fetch dashboard tasks', err))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('vi-VN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // Group tasks by category for "multi-column" feel
  const tasksByStatus = (status: string) => data?.tasks.filter(t => t.status === status) || [];

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-slate-700 font-semibold">
            <Calendar className="h-5 w-5 text-slate-400" />
            <span>Hôm nay, {today}</span>
          </div>
          <div className="flex space-x-1">
            <button className="p-1 hover:bg-slate-200 rounded transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <button className="p-1 hover:bg-slate-200 rounded transition-colors"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <div key={key} className={`${config.bg} ${config.border} border p-3 rounded-lg flex flex-col items-center text-center`}>
              <span className={`text-lg font-bold ${config.color}`}>{data?.stats[key] || 0}</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Task Grid - Calendar Style */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Ongoing Actions (Blue/Yellow) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Đang thực hiện</h3>
          <div className="space-y-3">
             {[...tasksByStatus('IN_PROGRESS'), ...tasksByStatus('PENDING')].map(task => (
               <TaskCard key={task.id} task={task} />
             ))}
             {tasksByStatus('IN_PROGRESS').length === 0 && tasksByStatus('PENDING').length === 0 && (
               <div className="text-xs text-slate-400 italic p-4 border border-dashed rounded-lg">Không có nhiệm vụ nào</div>
             )}
          </div>
        </div>

        {/* Column 2: Review & Finalizing (Orange/Teal) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Đang hoàn thiện</h3>
          <div className="space-y-3">
             {[...tasksByStatus('WAITING_FOR_DOCUMENT'), ...tasksByStatus('DONE')].map(task => (
               <TaskCard key={task.id} task={task} />
             ))}
             {tasksByStatus('WAITING_FOR_DOCUMENT').length === 0 && tasksByStatus('DONE').length === 0 && (
               <div className="text-xs text-slate-400 italic p-4 border border-dashed rounded-lg">Sạch sẽ!</div>
             )}
          </div>
        </div>

        {/* Column 3: History & Issues (Green/Red) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Hoàn thành & Khác</h3>
          <div className="space-y-3">
             {[...tasksByStatus('APPROVED'), ...tasksByStatus('REJECTED'), ...tasksByStatus('DELAYED')].map(task => (
               <TaskCard key={task.id} task={task} />
             ))}
             {tasksByStatus('APPROVED').length === 0 && tasksByStatus('REJECTED').length === 0 && tasksByStatus('DELAYED').length === 0 && (
               <div className="text-xs text-slate-400 italic p-4 border border-dashed rounded-lg">Chưa có kết quả mới</div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;

  return (
    <Link 
      href={`/projects/${task.projectId}`}
      className={`block p-4 ${config.bg} border ${config.border} rounded-xl hover:shadow-md transition-all group`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color} bg-white/50 px-2 py-0.5 rounded`}>
          {task.project.name}
        </span>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <h4 className="font-semibold text-slate-800 group-hover:text-slate-900 line-clamp-2 leading-snug mb-2">
        {taskTitleToPlainText(task.title) || 'Không có tiêu đề'}
      </h4>
      <div className="flex items-center text-[11px] text-slate-500 space-x-3">
        <div className="flex items-center">
          <Clock className="h-3 w-3 mr-1" />
          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'No deadline'}
        </div>
        <div className="flex items-center font-medium capitalize">
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.color.replace('text', 'bg')}`}></span>
          {config.label}
        </div>
      </div>
    </Link>
  );
}
