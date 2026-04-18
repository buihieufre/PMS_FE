import { Users, Settings, Mail, Bell, Plus, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';

interface SidebarProps {
  stats?: any;
  project?: any;
  members?: any[];
  onAddMember?: () => void;
}

export default function DashboardSidebar({ stats, project, members = [], onAddMember }: SidebarProps) {
  const { user } = useAuthStore();

  const isProjectMode = !!project;

  return (
    <div className="h-full bg-slate-50 border-r border-slate-200 p-4 flex flex-col space-y-6 overflow-y-auto">
      {/* Brand/Back */}
      <div className="flex items-center justify-between mb-4">
        {isProjectMode ? (
          <Link href="/projects" className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        ) : (
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Task Manager</h2>
        )}
        <button className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Profile / Project Info */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden shrink-0">
           <img 
             src={`https://ui-avatars.com/api/?name=${isProjectMode ? project.name : (user?.displayName || user?.email)}&background=${isProjectMode ? '10b981' : 'random'}&color=fff`} 
             alt="Avatar" 
             className="w-full h-full object-cover"
           />
        </div>
        <div className="px-2">
          <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{isProjectMode ? project.name : (user?.displayName || 'User Name')}</h3>
          <p className="text-[10px] text-slate-400 truncate tracking-tight">{isProjectMode ? 'Project Workspace' : user?.email}</p>
        </div>
      </div>

      {/* Global Actions - Hidden in project mode header but kept for profile if needed */}
      {!isProjectMode && (
        <div className="flex justify-center space-x-2">
          <button className="p-1.5 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-100 hover:scale-105 transition-transform">
            <Mail className="h-3.5 w-3.5" />
          </button>
          <button className="p-1.5 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-100 hover:scale-105 transition-transform relative">
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-[7px] font-bold px-1 rounded-full border border-white">8</span>
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="space-y-3 px-2">
        <div className="flex justify-between items-end text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
          <span>{isProjectMode ? 'Progress' : 'Tasks'}</span>
          <span>{stats?.APPROVED || 0} / {stats?.total || 0}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
           <div 
             className="h-full bg-emerald-500 transition-all duration-500" 
             style={{ width: `${stats?.total ? (stats.APPROVED / stats.total) * 100 : 0}%` }}
           />
        </div>
        <div className="grid grid-cols-3 gap-1 text-center py-2 border-b border-slate-100">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-emerald-600 leading-none">{stats?.APPROVED || 0}</span>
            <span className="text-[8px] text-slate-400 uppercase mt-1">Done</span>
          </div>
          <div className="flex flex-col border-x border-slate-100">
            <span className="text-xs font-bold text-amber-500 leading-none">{stats?.PENDING || 0}</span>
            <span className="text-[8px] text-slate-400 uppercase mt-1">To do</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 leading-none">{stats?.total || 0}</span>
            <span className="text-[8px] text-slate-400 uppercase mt-1">All</span>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-center px-2 mb-3">
          <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center">
            <Users className="h-3 w-3 mr-1.5 text-emerald-500" />
            Members
          </h4>
          {isProjectMode && (
            <button 
              onClick={onAddMember}
              className="p-1 bg-white border border-slate-200 rounded text-emerald-500 hover:bg-emerald-50 transition-colors"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
        
        <div className="space-y-2 overflow-y-auto px-1 pr-2 custom-scrollbar">
          {(isProjectMode ? members : [1, 2, 3, 4, 5]).map((m, i) => (
            <div key={isProjectMode ? m.id : i} className="flex items-center p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all group">
              <div className="w-8 h-8 rounded-full bg-slate-200 border border-white shrink-0 overflow-hidden shadow-sm mr-3">
                 <img 
                   src={`https://i.pravatar.cc/100?u=${isProjectMode ? m.user.id : m}`} 
                   alt="Member" 
                   className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all"
                 />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate leading-none mb-1">
                  {isProjectMode ? m.user.displayName : 'Team Member'}
                </p>
                <p className="text-[9px] text-slate-400 truncate">
                  {isProjectMode ? m.projectRole : 'Collaborator'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Action */}
      {!isProjectMode && (
        <button className="w-full flex items-center justify-center space-x-2 bg-emerald-500 text-white py-2.5 rounded-full text-xs font-bold shadow-lg shadow-emerald-100 hover:scale-105 transition-all">
          <Plus className="h-3 w-3" />
          <span>New Project</span>
        </button>
      )}
    </div>
  );
}
