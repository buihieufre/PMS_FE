import { useState, useEffect, useRef, Fragment } from 'react';
import { 
  CheckSquare, 
  Paperclip, 
  X, 
  Plus, 
  Clock, 
  ChevronDown,
  User as UserIcon,
  AlignLeft,
  Loader2,
  AlertTriangle,
  Search,
  Check,
  Calendar
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { Popover, Transition } from '@headlessui/react';
import TaskDatePicker from '../Project/TaskDatePicker';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  departments: any[];
  members: any[];
  onSuccess: () => void;
  initialStatus?: string;
}

export default function CreateTaskModal({ isOpen, onClose, projectId, departments, members, onSuccess, initialStatus }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [reminderOffset, setReminderOffset] = useState<number | null>(null);
  const [status, setStatus] = useState<string>(initialStatus || 'PENDING');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForcePrompt, setShowForcePrompt] = useState(false);

  // Member Search State
  const [isMemberSearchOpen, setIsMemberSearchOpen] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const memberSearchRef = useRef<HTMLDivElement>(null);

  // Update status when initialStatus changes or modal opens
  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus, isOpen]);

  // Click outside listener for member search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (memberSearchRef.current && !memberSearchRef.current.contains(event.target as Node)) {
        setIsMemberSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const submitTask = async (force = false) => {
    console.log('[CreateTask] Submitting task...', { title, status, assigneeIds });
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        status,
        departmentId: departmentId || null,
        assigneeIds: assigneeIds,
        startDate: startDate || null,
        dueDate: dueDate || null,
        reminderOffset,
      };

      console.log('[CreateTask] Payload:', payload);
      const url = `/projects/${projectId}/tasks${force ? '?force=true' : ''}`;
      const response = await axiosInstance.post(url, payload);
      console.log('[CreateTask] Success:', response.data);
      
      toast.success('Task created successfully');
      // Reset form
      setTitle(''); 
      setDescription(''); 
      setDepartmentId(''); 
      setAssigneeIds([]); 
      setStartDate(null);
      setDueDate(null);
      setReminderOffset(null);
      setShowForcePrompt(false);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[CreateTask] Error:', error);
      if (error.response?.data?.error === 'WORKLOAD_WARNING') {
        setShowForcePrompt(true);
      } else {
        toast.error(error.response?.data?.error || 'Failed to create task');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMembers = members.filter(m => assigneeIds.includes(m.userId));

  const filteredMembers = members.filter(m => 
    m.user?.displayName?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
    m.user?.email?.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          submitTask();
        }}
        className="bg-[#f1f2f4] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-[#172b4d] my-8"
      >
        
        {/* Modal Header */}
        <div className="px-8 py-5 flex justify-between items-start shrink-0">
          <div className="flex-1 pt-2">
            <div className="flex items-center space-x-3 mb-4">
               <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black cursor-pointer transition-all flex items-center outline-none shadow-sm uppercase tracking-wider text-slate-600 appearance-none pr-8 relative bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E')] bg-[length:12px] bg-[position:right_8px_center] bg-no-repeat"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Completed</option>
                  <option value="WAITING_FOR_DOCUMENT">Waiting</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="APPROVED">Approved</option>
               </select>

               <select 
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black cursor-pointer transition-all flex items-center outline-none shadow-sm uppercase tracking-wider text-indigo-600 appearance-none pr-8 relative bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E')] bg-[length:12px] bg-[position:right_8px_center] bg-no-repeat"
                >
                  <option value="">No Department</option>
                  {departments.map((dept: any) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
               </select>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm mt-1 flex items-center justify-center shrink-0">
                 <CheckSquare className="h-5 w-5 text-emerald-500" />
              </div>
              <input 
                autoFocus
                required
                placeholder="Task Title"
                className="w-full bg-transparent text-2xl font-black leading-tight outline-none border-b-2 border-transparent focus:border-emerald-500 placeholder:text-slate-300 pb-1 transition-all"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-1 pt-2">
             <button type="button" onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
               <X className="h-5 w-5" />
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-t-[40px] mx-1 mb-1 shadow-inner px-2 pt-2 min-h-[400px]">
          
          {/* Workload Warning */}
          {showForcePrompt && (
            <div className="mx-8 mt-6 bg-orange-50 border border-orange-200 text-orange-800 p-5 rounded-2xl flex items-start text-sm shadow-sm animate-in slide-in-from-top-2">
              <AlertTriangle className="h-6 w-6 mr-4 flex-shrink-0 text-orange-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-black text-base mb-1">Workload Warning</p>
                <p className="opacity-90 font-medium">This user already has 3 or more active tasks. Force assign anyway?</p>
                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={() => submitTask(true)} className="bg-orange-600 text-white px-6 py-2 rounded-xl text-xs hover:bg-orange-700 font-bold shadow-lg shadow-orange-100 transition-all active:scale-95">Force Assign</button>
                  <button type="button" onClick={() => setShowForcePrompt(false)} className="bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded-xl text-xs hover:bg-slate-50 font-bold transition-all">Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-0">
            
            {/* Main Content (Left) */}
            <div className="lg:col-span-6 p-10 space-y-12 border-r border-slate-50">
              
              {/* Action Buttons Bar */}
              <div className="flex flex-wrap gap-2.5">
                 <Popover className="relative">
                   <Popover.Button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center transition-all border border-slate-100 shadow-sm text-slate-600">
                      <Clock className="h-3.5 w-3.5 mr-2" /> Dates
                   </Popover.Button>
                   <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="opacity-0 translate-y-1"
                      enterTo="opacity-100 translate-y-0"
                      leave="transition ease-in duration-150"
                      leaveFrom="opacity-100 translate-y-0"
                      leaveTo="opacity-0 translate-y-1"
                    >
                      <Popover.Panel className="absolute z-50 mt-3 left-0">
                        <TaskDatePicker 
                          isOpen={true}
                          onClose={() => {}}
                          initialStartDate={startDate || undefined}
                          initialDueDate={dueDate || undefined}
                          initialReminderOffset={reminderOffset || undefined}
                          onSave={(data) => {
                            setStartDate(data.startDate || null);
                            setDueDate(data.dueDate || null);
                            setReminderOffset(data.reminderOffset || null);
                          }}
                          onRemove={() => {
                            setStartDate(null);
                            setDueDate(null);
                            setReminderOffset(null);
                          }}
                        />
                      </Popover.Panel>
                    </Transition>
                 </Popover>
                 <button type="button" className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center transition-all border border-slate-100 shadow-sm text-slate-600">
                    <CheckSquare className="h-3.5 w-3.5 mr-2" /> Checklist
                 </button>
                 <button type="button" className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center transition-all border border-slate-100 shadow-sm text-slate-600">
                    <Paperclip className="h-3.5 w-3.5 mr-2" /> Attachment
                 </button>
              </div>

              {/* Assignments & Dates Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                 <div className="space-y-3" ref={memberSearchRef}>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Assignee</h4>
                    
                    <div className="relative">
                        <button 
                         type="button"
                         onClick={() => setIsMemberSearchOpen(!isMemberSearchOpen)}
                         className={`w-full group px-4 py-3 bg-slate-50 hover:bg-white border-2 rounded-2xl flex items-center transition-all ${
                            isMemberSearchOpen ? 'border-emerald-500 shadow-lg ring-4 ring-emerald-500/5' : 'border-slate-100'
                         }`}
                       >
                          {selectedMembers.length > 0 ? (
                             <div className="flex items-center space-x-3 text-left overflow-x-hidden">
                                <div className="flex -space-x-2">
                                  {selectedMembers.slice(0, 3).map((m) => (
                                     <div key={m.userId} className="w-8 h-8 rounded-full shadow-sm overflow-hidden border-2 border-white ring-1 ring-slate-200">
                                        <img src={`https://ui-avatars.com/api/?name=${m.user?.displayName}&background=random`} alt="avatar" />
                                     </div>
                                  ))}
                                  {selectedMembers.length > 3 && (
                                     <div className="w-8 h-8 rounded-full shadow-sm overflow-hidden border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                       +{selectedMembers.length - 3}
                                     </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                   <p className="text-[11px] font-black text-slate-800 truncate leading-none mb-1">
                                     {selectedMembers.length === 1 ? selectedMembers[0].user?.displayName : `${selectedMembers.length} Members`}
                                   </p>
                                </div>
                             </div>
                          ) : (
                             <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                                   <UserIcon className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-slate-400">Select assignees...</span>
                             </div>
                          )}
                          <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${isMemberSearchOpen ? 'rotate-180 text-emerald-500' : 'text-slate-300'}`} />
                       </button>

                       {isMemberSearchOpen && (
                          <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
                             <div className="relative px-2 py-1 mb-2">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                <input 
                                   type="text"
                                   autoFocus
                                   placeholder="Filter board members..."
                                   value={memberSearchTerm}
                                   onChange={(e) => setMemberSearchTerm(e.target.value)}
                                   className="w-full pl-8 pr-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none"
                                />
                             </div>
                             <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                <button 
                                   type="button"
                                   onClick={() => { setAssigneeIds([]); setIsMemberSearchOpen(false); }}
                                   className="w-full flex items-center p-2 hover:bg-rose-50 rounded-xl transition-colors group"
                                >
                                   <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mr-3 text-slate-300 group-hover:text-rose-400">
                                      <X className="h-4 w-4" />
                                   </div>
                                   <span className="text-xs font-bold text-slate-400 group-hover:text-rose-500">Unassign All</span>
                                </button>
                                <div className="h-px bg-slate-50 my-1" />
                                {filteredMembers.map((m) => {
                                   const isAssigned = assigneeIds.includes(m.userId);
                                   return (
                                     <button 
                                       key={m.userId}
                                       type="button"
                                       onClick={() => {
                                          setAssigneeIds(prev => isAssigned ? prev.filter(id => id !== m.userId) : [...prev, m.userId]);
                                       }}
                                       className={`w-full flex items-center p-2 rounded-xl transition-all ${
                                          isAssigned ? 'bg-emerald-50' : 'hover:bg-slate-50'
                                       }`}
                                     >
                                        <div className="w-8 h-8 rounded-full overflow-hidden mr-3 shadow-sm">
                                           <img src={`https://ui-avatars.com/api/?name=${m.user?.displayName}&background=random`} alt="avatar" />
                                        </div>
                                        <div className="flex-1 text-left">
                                           <p className={`text-xs font-black ${isAssigned ? 'text-emerald-600' : 'text-slate-700'}`}>{m.user?.displayName}</p>
                                           <p className="text-[10px] text-slate-400 font-medium truncate">{m.user?.email}</p>
                                        </div>
                                        {isAssigned && <Check className="h-4 w-4 text-emerald-500" />}
                                     </button>
                                   );
                                })}
                             </div>
                          </div>
                       )}
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Dates</h4>
                    <div className="flex flex-wrap gap-2">
                       {startDate && (
                         <div className="px-4 py-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-[10px] font-black flex items-center shadow-sm">
                            <Calendar className="h-3 w-3 mr-2" />
                            Start: {new Date(startDate).toLocaleDateString()}
                         </div>
                       )}
                       {dueDate && (
                         <div className="px-4 py-2 bg-amber-50 border border-amber-100 text-amber-600 rounded-xl text-[10px] font-black flex items-center shadow-sm">
                            <Clock className="h-3 w-3 mr-2" />
                            Due: {new Date(dueDate).toLocaleDateString()}
                         </div>
                       )}
                       {!startDate && !dueDate && (
                         <div className="px-4 py-2 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl text-[10px] font-bold italic">
                            No dates set
                         </div>
                       )}
                    </div>
                 </div>
              </div>
              
              {/* Description */}
              <section className="space-y-4">
                <div className="flex items-center space-x-4 font-black text-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <AlignLeft className="h-4 w-4 text-indigo-500" />
                  </div>
                  <h3 className="text-sm tracking-tight uppercase">Description</h3>
                </div>
                <div className="ml-12 relative group">
                  <textarea 
                    placeholder="Describe what needs to be done..."
                    className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl p-5 text-sm text-slate-700 outline-none transition-all min-h-[160px] placeholder:text-slate-300 font-medium shadow-none focus:shadow-xl focus:shadow-indigo-500/5"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </section>
            </div>

            {/* Side Content (Right) */}
            <div className="lg:col-span-4 p-8 space-y-8 bg-slate-50/20">
               <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="flex items-center space-x-3 mb-6">
                       <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                          <CheckSquare className="h-5 w-5 text-emerald-400" />
                       </div>
                       <div>
                          <h3 className="text-lg font-black leading-none">New Card</h3>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Ready for board</p>
                       </div>
                    </div>
                    
                    <div className="space-y-4 mb-10">
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Column Position</p>
                          <p className="text-sm font-black text-white">{status.replace(/_/g, ' ')}</p>
                       </div>
                       
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Priority</p>
                          <select className="bg-transparent border-none text-sm font-black text-white outline-none w-full p-0 cursor-pointer">
                             <option value="LOW" className="text-slate-900">Low</option>
                             <option value="NORMAL" className="text-slate-900" selected>Normal</option>
                             <option value="HIGH" className="text-slate-900">High</option>
                             <option value="URGENT" className="text-slate-900">Urgent</option>
                          </select>
                       </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting || showForcePrompt}
                      className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-base hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center transform group-hover:translate-y-[-2px]"
                    >
                      {isSubmitting ? (
                         <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                         'Create Task'
                      )}
                    </button>
                  </div>
                  <CheckSquare className="absolute -right-8 -bottom-8 h-40 w-40 text-white opacity-[0.03] group-hover:rotate-12 transition-transform duration-700" />
               </div>

               <div className="flex flex-col items-center justify-center pt-4 space-y-4">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="text-[10px] font-black text-slate-400 hover:text-rose-500 transition-all uppercase tracking-[0.2em] px-4 py-2 hover:bg-rose-50 rounded-xl"
                  >
                    Cancel
                  </button>
               </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}
