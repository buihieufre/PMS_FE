import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { taskTitleToPlainText } from '@/lib/taskDescription';

interface Task {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  projectId?: string;
  project: { name: string };
}

interface CalendarProps {
  tasks?: Task[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: (date: Date) => void;
}

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-500',
  PENDING: 'bg-amber-400',
  DONE: 'bg-teal-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-rose-500',
  DELAYED: 'bg-rose-600',
  WAITING_FOR_DOCUMENT: 'bg-orange-500',
};

// --- Native Date Helpers ---
const getDaysInMonth = (currentDate: Date) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // First day of target month
  const firstDayOfMonth = new Date(year, month, 1);
  // Last day of target month
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  // Calculate padding days at the front (Assume Monday is start of week)
  // getDay() returns 0 for Sunday. We want Monday=0, ..., Sunday=6.
  const firstDayWeekday = firstDayOfMonth.getDay();
  const paddingFront = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

  const days: { date: Date; currentMonth: boolean }[] = [];

  // Previous month padding
  for (let i = paddingFront; i > 0; i--) {
    days.push({ date: new Date(year, month, 1 - i), currentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    days.push({ date: new Date(year, month, i), currentMonth: true });
  }

  // Next month padding to fill a full grid (usually 42 cells)
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push({ date: new Date(year, month + 1, i), currentMonth: false });
  }

  return days;
};

const isSameDay = (d1: Date, d2: Date) => 
  d1.getFullYear() === d2.getFullYear() && 
  d1.getMonth() === d2.getMonth() && 
  d1.getDate() === d2.getDate();

const formatDateLabel = (date: Date, view: 'month' | 'week') => {
  if (view === 'month') {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  } else {
    // Week view: "Feb 10 - Feb 16, 2024"
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startStr = startOfWeek.toLocaleString('default', { month: 'short', day: 'numeric' });
    const endStr = endOfWeek.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }
};

const getDaysInWeek = (currentDate: Date) => {
  const day = currentDate.getDay();
  // Monday is 0, Sunday is 6
  const paddingFront = day === 0 ? 6 : day - 1;
  const days: { date: Date; currentMonth: boolean }[] = [];
  
  for (let i = paddingFront; i > 0; i--) {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() - i);
    days.push({ date: d, currentMonth: true });
  }
  for (let i = 0; i < 7 - paddingFront; i++) {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() + i);
    days.push({ date: d, currentMonth: true });
  }
  return days;
};

// --- Main Component ---
export default function DashboardCalendar({ tasks = [], onTaskClick, onAddTask }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [showWeekends, setShowWeekends] = useState(true);

  const daysRaw = useMemo(() => viewMode === 'month' ? getDaysInMonth(currentDate) : getDaysInWeek(currentDate), [currentDate, viewMode]);
  
  const days = useMemo(() => {
    if (showWeekends) return daysRaw;
    return daysRaw.filter(d => {
      const day = d.date.getDay();
      return day !== 0 && day !== 6;
    });
  }, [daysRaw, showWeekends]);

  const weekdays = showWeekends 
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const next = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };
  
  const prev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  return (
    <div className="h-full bg-white flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-100 shrink-0">
        <div className="relative w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search" 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-200 rounded-lg text-sm outline-none transition-all"
          />
        </div>

        <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold text-slate-800">Calendar</h2>
          <div className="flex items-center space-x-4 mt-2">
               <button onClick={prev} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
               <span className="text-sm font-semibold text-slate-600 min-w-[200px] text-center">{formatDateLabel(currentDate, viewMode)}</span>
               <button onClick={next} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors"><ChevronRight className="h-4 w-4" /></button>
            </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex p-0.5 bg-slate-100 rounded-lg">
             <button 
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === 'week' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
             >
                Week
             </button>
             <button 
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === 'month' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
             >
                Month
             </button>
          </div>
          <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><MoreHorizontal className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Grid Header */}
      <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} border-b border-slate-100 shrink-0`}>
        {weekdays.map(day => (
          <div key={day} className="py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className={`flex-1 grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} auto-rows-fr overflow-y-auto`}>
        {days.map((item, idx) => {
          const { date, currentMonth } = item;
          const dayTasks = tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), date));
          const isToday = isSameDay(date, new Date());

          return (
            <div 
              key={idx} 
              className={`min-h-[120px] p-4 border-r border-b border-slate-50 relative hover:bg-slate-50/50 transition-colors ${!currentMonth ? 'bg-slate-50/30' : ''}`}
            >
              <span className={`text-sm font-bold ${isToday ? 'text-emerald-500' : currentMonth ? 'text-slate-800' : 'text-slate-300'}`}>
                {date.getDate()}
              </span>
              
              <div className="mt-2 space-y-1">
                {dayTasks.map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => onTaskClick?.(task)}
                    className="flex items-center space-x-1.5 cursor-pointer group/chip"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[task.status] || 'bg-slate-400'}`} />
                    <span className="text-[10px] font-medium text-slate-600 line-clamp-1 group-hover/chip:text-slate-900 transition-colors">
                      {taskTitleToPlainText(task.title, 80) || '—'}
                    </span>
                  </div>
                ))}
              </div>

              {isToday && (
                <div className="absolute left-0 top-0 w-0.5 h-full bg-amber-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Buttons */}
      <div className="absolute bottom-6 right-6 flex flex-col space-y-4">
          <div className="p-1 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full shadow-xl flex space-x-2">
            <button 
              onClick={() => setShowWeekends(!showWeekends)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${showWeekends ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {showWeekends ? 'Hide Weekends' : 'Show Weekends'}
            </button>
            <button 
              onClick={() => onAddTask?.(currentDate)}
              className="px-4 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center space-x-1"
            >
                <Plus className="h-3 w-3" />
                <span>Add task</span>
            </button>
          </div>
      </div>
    </div>
  );
}
