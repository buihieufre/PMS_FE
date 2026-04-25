import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, differenceInSeconds } from 'date-fns';
import { ChevronLeft, ChevronRight, X, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface TaskDatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate?: string;
  initialDueDate?: string;
  initialReminderOffset?: number;
  onSave: (data: { startDate?: string | null; dueDate?: string | null; reminderOffset?: number | null }) => void;
  onRemove: () => void;
}

const REMINDER_OPTIONS = [
  { label: 'Không có', value: 0 },
  { label: 'Tại thời điểm hết hạn', value: 1 },
  { label: '5 phút trước', value: 5 },
  { label: '10 phút trước', value: 10 },
  { label: '15 phút trước', value: 15 },
  { label: '1 giờ trước', value: 60 },
  { label: '2 giờ trước', value: 120 },
  { label: '1 ngày trước', value: 1440 },
  { label: '2 ngày trước', value: 2880 },
];

export default function TaskDatePicker({ isOpen, onClose, initialStartDate, initialDueDate, initialReminderOffset, onSave, onRemove }: TaskDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const timeInputRef = React.useRef<HTMLInputElement>(null);
  
  const [startDateEnabled, setStartDateEnabled] = useState(!!initialStartDate);
  const [startDate, setStartDate] = useState(initialStartDate ? new Date(initialStartDate) : new Date());
  
  const [dueDateEnabled, setDueDateEnabled] = useState(!!initialDueDate);
  const [dueDate, setDueDate] = useState(initialDueDate ? new Date(initialDueDate) : new Date());
  const [dueTime, setDueTime] = useState(initialDueDate ? format(new Date(initialDueDate), 'HH:mm') : '12:00');
  
  const [reminderOffset, setReminderOffset] = useState(initialReminderOffset || 0);

  // Update current time every second for the countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const getFinalDueDate = () => {
    if (!dueDateEnabled) return null;
    const [hours, minutes] = dueTime.split(':');
    const dateWithTime = new Date(dueDate);
    dateWithTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return dateWithTime;
  };

  const calculateCountdown = () => {
    const target = getFinalDueDate();
    if (!target) return null;

    const diff = differenceInSeconds(target, now);
    if (diff <= 0) return 'Đã quá hạn';

    const d = Math.floor(diff / (24 * 3600));
    const h = Math.floor((diff % (24 * 3600)) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = Math.floor(diff % 60);

    let res = 'Còn lại: ';
    if (d > 0) res += `${d} ngày `;
    if (h > 0 || d > 0) res += `${h} giờ `;
    if (m > 0 || h > 0 || d > 0) res += `${m} phút `;
    res += `${s} giây`;
    return res;
  };

  const handleSave = () => {
    const finalStartDate = startDateEnabled ? startDate.toISOString() : null;
    const finalDueDateObj = getFinalDueDate();
    const finalDueDate = finalDueDateObj ? finalDueDateObj.toISOString() : null;

    onSave({
      startDate: finalStartDate,
      dueDate: finalDueDate,
      reminderOffset: dueDateEnabled ? reminderOffset : null,
    });
  };

  return (
    <div className="w-auto min-w-[320px] max-w-[400px] bg-white rounded-tr-2xl rounded-br-none rounded-l-none shadow-2xl border-l border-slate-200 animate-in fade-in zoom-in-95 duration-200 text-[#172b4d] h-[calc(100vh-56px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 shrink-0">
        <div className="w-8" /> {/* Spacer */}
        <h4 className="text-sm font-bold text-slate-600">Ngày</h4>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto custom-scrollbar flex-1">

      {/* Calendar View */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-slate-800">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <div className="flex space-x-1">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100">
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100">
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
            <span key={day} className="text-[10px] font-bold text-slate-400 uppercase py-1">{day}</span>
          ))}
          {days.map((day, idx) => {
            const isStart = startDateEnabled && isSameDay(day, startDate);
            const isDue = dueDateEnabled && isSameDay(day, dueDate);
            const isSelected = isStart || isDue;
            
            return (
              <button
                key={idx}
                onClick={() => {
                  if (dueDateEnabled) setDueDate(day);
                  else if (startDateEnabled) setStartDate(day);
                }}
                className={`h-11 w-11 text-sm rounded-lg transition-all relative flex items-center justify-center ${
                  !isSameMonth(day, currentMonth) ? 'text-slate-300' : 'text-slate-700 font-medium'
                } ${
                  isSelected 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'hover:bg-slate-100'
                }`}
              >
                {format(day, 'd')}
                {isStart && isDue && (
                  <div className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        {/* Start Date */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
            <Calendar className="h-3 w-3 mr-2" /> Ngày bắt đầu
          </label>
          <div className="flex items-center space-x-3">
            <input 
              type="checkbox" 
              checked={startDateEnabled}
              onChange={(e) => setStartDateEnabled(e.target.checked)}
              className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm" 
            />
            <input 
              type="date"
              disabled={!startDateEnabled}
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="flex-1 min-w-0 text-sm p-2.5 border border-slate-200 rounded-lg bg-slate-50/50 disabled:opacity-50 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium"
            />
          </div>
        </div>

        {/* Due Date */}
        <div className="space-y-3 text-red">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <button 
              onClick={() => timeInputRef.current?.showPicker?.()} 
              className="flex items-center hover:text-[#0c66e4] transition-colors group"
            >
               <Clock className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" /> 
               <span>Giờ hết hạn</span>
            </button>
          </label>
          {dueDateEnabled && (
              <div className="animate-in fade-in slide-in-from-top-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${calculateCountdown()?.includes('passed') ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                      {calculateCountdown()}
                  </span>
              </div>
          )}
          <div className="flex items-center space-x-3">
            <input 
              type="checkbox" 
              checked={dueDateEnabled}
              onChange={(e) => setDueDateEnabled(e.target.checked)}
              className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm" 
            />
            <div className="flex-1 flex gap-2 min-w-0">
              <input 
                type="date"
                disabled={!dueDateEnabled}
                value={format(dueDate, 'yyyy-MM-dd')}
                onChange={(e) => setDueDate(new Date(e.target.value))}
                className="flex-[1.5] min-w-0 text-sm p-2.5 border border-slate-200 rounded-lg bg-slate-50/50 disabled:opacity-50 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium"
              />
              <input 
                ref={timeInputRef}
                type="time"
                disabled={!dueDateEnabled}
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="flex-1 min-w-0 text-sm p-2.5 border border-slate-200 rounded-lg bg-slate-50/50 disabled:opacity-50 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Reminder Offset */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thiết lập lời nhắc</label>
            <button 
              onClick={() => {
                toast.success('Hãy đặt thời gian hết hạn sau 1 phút và nhấn Lưu để test nhé!');
              }}
              className="text-[10px] font-bold text-[#0c66e4] hover:underline"
            >
              HD Test
            </button>
          </div>
          <select
            disabled={!dueDateEnabled}
            value={reminderOffset}
            onChange={(e) => setReminderOffset(parseInt(e.target.value))}
            className="w-full text-sm p-2.5 border border-slate-200 rounded-lg bg-slate-50/50 disabled:opacity-50 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium cursor-pointer"
          >
            {REMINDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
            Lời nhắc sẽ được gửi tới tất cả thành viên được giao công việc này.
          </p>
        </div>
      </div>

      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-100 space-y-2 shrink-0 bg-white">
        <button 
          onClick={handleSave}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-sm transition-all shadow-sm active:scale-[0.98]"
        >
          Lưu
        </button>
        <button 
          onClick={() => {
            onRemove();
            onClose();
          }}
          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-bold text-sm transition-all active:scale-[0.98]"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}
