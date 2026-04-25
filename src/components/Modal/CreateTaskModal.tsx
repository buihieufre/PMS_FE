import { useState, useEffect, useRef, Fragment, useMemo, useCallback, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { getEditorTools } from '@/lib/editorTools';
import { parseTaskDescriptionData } from '@/lib/taskDescription';
import { 
  CheckSquare, 
  Paperclip, 
  X, 
  Plus, 
  Clock, 
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  AlignLeft,
  Loader2,
  AlertTriangle,
  Search,
  Check,
  Calendar,
  Tag,
  Link as LinkIcon,
  Maximize2
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { Popover, Transition } from '@headlessui/react';
import TaskDatePicker from '../Project/TaskDatePicker';
import { useSocket } from '@/hooks/useSocket';
import DescriptionEditorExpandModal from './DescriptionEditorExpandModal';

const EditorJs = dynamic(
  () => import('react-editor-js').then((mod) => mod.createReactEditorJS()),
  { ssr: false }
);

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
  interface Label {
    id: string;
    name: string | null;
    color: string;
  }
  interface ChecklistDraft {
    id: string;
    title: string;
    items: string[];
    newItem: string;
  }

  const [title, setTitle] = useState('');
  /** JSON OutputData từ Editor.js; đồng bộ bằng onChange (khi mở lại modal vẫn còn nội dung). */
  const [description, setDescription] = useState('');
  const [descriptionEditorKey, setDescriptionEditorKey] = useState(0);
  const descriptionEditorRef = useRef<any>(null);
  const tools = useMemo(() => getEditorTools(), []);
  // Chỉ khi descriptionEditorKey đổi (mở modal / tạo xong): lấy description hiện tại; không phụ thuộc mỗi lần gõ để không reset editor.
  const descriptionDefault = useMemo(
    () => parseTaskDescriptionData(description),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cố ý chỉ remount editor khi đổi key
    [descriptionEditorKey]
  );
  const handleDescriptionInit = useCallback((core: any) => {
    descriptionEditorRef.current = core;
  }, []);
  const handleDescriptionChange = useCallback(async () => {
    if (!descriptionEditorRef.current) return;
    try {
      const data = await descriptionEditorRef.current.save();
      setDescription(JSON.stringify(data));
    } catch {
      // ignore
    }
  }, []);
  const prevIsOpen = useRef(false);
  useLayoutEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setDescriptionEditorKey((k) => k + 1);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [checklists, setChecklists] = useState<ChecklistDraft[]>([
    { id: `draft-${Date.now()}`, title: 'Checklist', items: [], newItem: '' }
  ]);
  const [attachmentLink, setAttachmentLink] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [reminderOffset, setReminderOffset] = useState<number | null>(null);
  const [status, setStatus] = useState<string>(initialStatus || 'PENDING');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForcePrompt, setShowForcePrompt] = useState(false);
  const [descriptionExpandOpen, setDescriptionExpandOpen] = useState(false);
  const submitInFlightRef = useRef(false);
  const { emit } = useSocket(projectId);

  // Member Search State
  const [isMemberSearchOpen, setIsMemberSearchOpen] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isLabelSearchOpen, setIsLabelSearchOpen] = useState(false);
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  const memberSearchRef = useRef<HTMLDivElement>(null);
  const labelSearchRef = useRef<HTMLDivElement>(null);

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
      if (labelSearchRef.current && !labelSearchRef.current.contains(event.target as Node)) {
        setIsLabelSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    const fetchLabels = async () => {
      try {
        const res = await axiosInstance.get(`/projects/${projectId}/labels`);
        setLabels(res.data || []);
      } catch (error) {
        console.error('Failed to fetch labels', error);
      }
    };
    fetchLabels();
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const submitTask = async (force = false) => {
    console.log('[CreateTask] Submitting task...', { title, status, assigneeIds });
    if (!title.trim()) {
      toast.error('Tiêu đề công việc là bắt buộc');
      return;
    }
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const selectedMembersForDepartment = members.filter(m => assigneeIds.includes(m.userId));
      const selectedDepartmentIds = Array.from(
        new Set(
          selectedMembersForDepartment
            .map((m: any) => m.departmentId || m.user?.departmentId || null)
            .filter(Boolean)
        )
      );
      const derivedDepartmentId = selectedDepartmentIds.length === 1 ? selectedDepartmentIds[0] : null;

      let descriptionPayload = description;
      if (descriptionEditorRef.current) {
        try {
          const saved = await descriptionEditorRef.current.save();
          descriptionPayload = JSON.stringify(saved);
        } catch (e) {
          console.error('[CreateTask] Editor save failed', e);
        }
      }

      const payload = {
        title: title.trim(),
        description: descriptionPayload,
        status,
        departmentId: derivedDepartmentId,
        assigneeIds: assigneeIds,
        labelIds: labelIds,
        startDate: startDate || null,
        dueDate: dueDate || null,
        reminderOffset,
      };

      console.log('[CreateTask] Payload:', payload);
      const url = `/projects/${projectId}/tasks${force ? '?force=true' : ''}`;
      const response = await axiosInstance.post(url, payload);
      console.log('[CreateTask] Success:', response.data);

      const taskId = response?.data?.task?.id;
      if (taskId) {
        const validChecklists = checklists
          .map((cl) => ({
            title: cl.title.trim() || 'Checklist',
            items: cl.items.map((item) => item.trim()).filter(Boolean)
          }))
          .filter((cl) => cl.items.length > 0 || cl.title);

        if (validChecklists.length > 0) {
          const emitChecklistItemAdd = (checklistId: string, itemTitle: string) => new Promise<void>((resolve, reject) => {
            emit('checklistItem:add', { checklistId, projectId, taskId, title: itemTitle }, (res: any) => {
              if (res?.status === 'success') resolve();
              else reject(new Error(res?.message || 'Không tạo được mục checklist'));
            });
          });

          for (const group of validChecklists) {
            const createdChecklist = await new Promise<any>((resolve, reject) => {
              emit('checklist:create', { taskId, projectId, title: group.title }, (res: any) => {
                if (res?.status === 'success') resolve(res.checklist);
                else reject(new Error(res?.message || 'Không tạo được checklist'));
              });
            });
            if (createdChecklist?.id) {
              for (const item of group.items) {
                await emitChecklistItemAdd(createdChecklist.id, item);
              }
            }
          }
        }

        if (attachmentLink.trim()) {
          await axiosInstance.post(`/projects/${projectId}/tasks/${taskId}/attachments`, {
            link: attachmentLink.trim(),
            fileName: attachmentLink.trim()
          });
        }

        for (const file of attachmentFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('fileName', file.name);
          await axiosInstance.post(`/projects/${projectId}/tasks/${taskId}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      }
      
      toast.success('Công việc đã được tạo thành công');
      // Reset form
      setTitle('');
      setDescription('');
      setDescriptionEditorKey((k) => k + 1);
      setAssigneeIds([]); 
      setLabelIds([]);
      setChecklists([{ id: `draft-${Date.now()}`, title: 'Checklist', items: [], newItem: '' }]);
      setAttachmentLink('');
      setAttachmentFiles([]);
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
        toast.error(error.response?.data?.error || 'Tạo công việc thất bại');
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const selectedMembers = members.filter(m => assigneeIds.includes(m.userId));
  const selectedLabels = labels.filter(l => labelIds.includes(l.id));
  const selectedMembersDepartments = Array.from(
    new Set(
      selectedMembers
        .map((m: any) => m.department?.name || m.user?.department?.name || null)
        .filter(Boolean)
    )
  );

  const filteredMembers = members.filter(m => 
    m.user?.displayName?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
    m.user?.email?.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );
  const filteredLabels = labels.filter(l => (l.name || '').toLowerCase().includes(labelSearchTerm.toLowerCase()));

  const addChecklistGroup = () => {
    setChecklists((prev) => [
      ...prev,
      { id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: `Checklist ${prev.length + 1}`, items: [], newItem: '' }
    ]);
  };

  const removeChecklistGroup = (groupId: string) => {
    setChecklists((prev) => {
      const next = prev.filter((g) => g.id !== groupId);
      return next.length > 0 ? next : [{ id: `draft-${Date.now()}`, title: 'Checklist', items: [], newItem: '' }];
    });
  };

  const updateChecklistTitle = (groupId: string, title: string) => {
    setChecklists((prev) => prev.map((g) => (g.id === groupId ? { ...g, title } : g)));
  };

  const updateChecklistNewItem = (groupId: string, newItem: string) => {
    setChecklists((prev) => prev.map((g) => (g.id === groupId ? { ...g, newItem } : g)));
  };

  const addChecklistItemToGroup = (groupId: string) => {
    setChecklists((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const trimmed = g.newItem.trim();
        if (!trimmed) return g;
        return { ...g, items: [...g.items, trimmed], newItem: '' };
      })
    );
  };

  const removeChecklistItemFromGroup = (groupId: string, itemIndex: number) => {
    setChecklists((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, items: g.items.filter((_, i) => i !== itemIndex) } : g))
    );
  };

  const moveChecklistGroup = (groupIndex: number, direction: 'up' | 'down') => {
    setChecklists((prev) => {
      const targetIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[groupIndex], next[targetIndex]] = [next[targetIndex], next[groupIndex]];
      return next;
    });
  };

  const moveChecklistItem = (groupId: string, itemIndex: number, direction: 'up' | 'down') => {
    setChecklists((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group;
        const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
        if (targetIndex < 0 || targetIndex >= group.items.length) return group;
        const nextItems = [...group.items];
        [nextItems[itemIndex], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[itemIndex]];
        return { ...group, items: nextItems };
      })
    );
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          if (showForcePrompt) return;
          submitTask();
        }}
        className="bg-[#f1f2f4] w-full max-w-4xl max-h-[calc(100vh-2rem)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-[#172b4d] my-0"
      >
        
        {/* Modal Header */}
        <div className="px-8 py-5 flex justify-between items-start shrink-0 sticky top-0 z-20 bg-[#f1f2f4] border-b border-slate-200/60">
          <div className="flex-1 pt-2">
            <div className="flex items-center space-x-3 mb-4">
               <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black cursor-pointer transition-all flex items-center outline-none shadow-sm uppercase tracking-wider text-slate-600 appearance-none pr-8 relative bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E')] bg-[length:12px] bg-[position:right_8px_center] bg-no-repeat"
                >
                  <option value="PENDING">Chờ xử lý</option>
                  <option value="IN_PROGRESS">Đang thực hiện</option>
                  <option value="DONE">Hoàn thành</option>
                  <option value="WAITING_FOR_DOCUMENT">Chờ tài liệu</option>
                  <option value="DELAYED">Tạm hoãn</option>
                  <option value="APPROVED">Đã duyệt</option>
               </select>

               <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black shadow-sm uppercase tracking-wider text-indigo-600">
                 {selectedMembersDepartments.length === 1
                   ? `Phòng ban: ${selectedMembersDepartments[0]}`
                   : selectedMembersDepartments.length > 1
                   ? 'Phòng ban: Nhiều phòng ban'
                   : 'Phòng ban: Theo nhân sự được giao'}
               </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm mt-1 flex items-center justify-center shrink-0">
                 <CheckSquare className="h-5 w-5 text-emerald-500" />
              </div>
              <input 
                autoFocus
                required
                placeholder="Tiêu đề công việc"
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
                <p className="font-black text-base mb-1">Cảnh báo khối lượng công việc</p>
                <p className="opacity-90 font-medium">Người dùng này đã có 3 hoặc nhiều công việc đang thực hiện. Vẫn tiếp tục giao việc?</p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitTask(true)}
                    className="bg-orange-600 text-white px-6 py-2 rounded-xl text-xs font-bold shadow-lg shadow-orange-100 transition-all active:scale-95 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Đang tạo…' : 'Tiếp tục giao'}
                  </button>
                  <button type="button" onClick={() => setShowForcePrompt(false)} className="bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded-xl text-xs hover:bg-slate-50 font-bold transition-all">Hủy</button>
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
                      <Clock className="h-3.5 w-3.5 mr-2" /> Thời gian
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
                 <button type="button" className="px-4 py-2 bg-slate-50 rounded-xl text-xs font-bold flex items-center border border-slate-100 shadow-sm text-slate-600 cursor-default">
                    <CheckSquare className="h-3.5 w-3.5 mr-2" /> Checklist
                 </button>
                 <button type="button" className="px-4 py-2 bg-slate-50 rounded-xl text-xs font-bold flex items-center border border-slate-100 shadow-sm text-slate-600 cursor-default">
                    <Paperclip className="h-3.5 w-3.5 mr-2" /> Đính kèm
                 </button>
              </div>

              {/* Assignments & Dates Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                 <div className="space-y-3" ref={memberSearchRef}>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Người thực hiện</h4>
                    
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
                                     {selectedMembers.length === 1 ? selectedMembers[0].user?.displayName : `${selectedMembers.length} Thành viên`}
                                   </p>
                                </div>
                             </div>
                          ) : (
                             <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                                   <UserIcon className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-slate-400">Chọn người thực hiện...</span>
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
                                   placeholder="Tìm kiếm thành viên..."
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
                                   <span className="text-xs font-bold text-slate-400 group-hover:text-rose-500">Bỏ chọn tất cả</span>
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
                 
                 <div className="space-y-3" ref={labelSearchRef}>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Nhãn</h4>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsLabelSearchOpen(!isLabelSearchOpen)}
                        className={`w-full group px-4 py-3 bg-slate-50 hover:bg-white border-2 rounded-2xl flex items-center transition-all ${
                          isLabelSearchOpen ? 'border-emerald-500 shadow-lg ring-4 ring-emerald-500/5' : 'border-slate-100'
                        }`}
                      >
                        {selectedLabels.length > 0 ? (
                          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                            {selectedLabels.slice(0, 3).map((label) => (
                              <span
                                key={label.id}
                                className="px-2 py-1 rounded-md text-[10px] font-black text-white whitespace-nowrap"
                                style={{ backgroundColor: label.color }}
                              >
                                {label.name || 'Không tên'}
                              </span>
                            ))}
                            {selectedLabels.length > 3 && (
                              <span className="text-[10px] font-black text-slate-500 whitespace-nowrap">+{selectedLabels.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                              <Tag className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-400">Chọn nhãn...</span>
                          </div>
                        )}
                        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${isLabelSearchOpen ? 'rotate-180 text-emerald-500' : 'text-slate-300'}`} />
                      </button>

                      {isLabelSearchOpen && (
                        <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
                          <div className="relative px-2 py-1 mb-2">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Tìm kiếm nhãn..."
                              value={labelSearchTerm}
                              onChange={(e) => setLabelSearchTerm(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none"
                            />
                          </div>
                          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                            <button
                              type="button"
                              onClick={() => {
                                setLabelIds([]);
                                setIsLabelSearchOpen(false);
                              }}
                              className="w-full flex items-center p-2 hover:bg-rose-50 rounded-xl transition-colors group"
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mr-3 text-slate-300 group-hover:text-rose-400">
                                <X className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-bold text-slate-400 group-hover:text-rose-500">Bỏ chọn tất cả</span>
                            </button>
                            <div className="h-px bg-slate-50 my-1" />
                            {filteredLabels.map((label) => {
                              const isSelected = labelIds.includes(label.id);
                              return (
                                <button
                                  key={label.id}
                                  type="button"
                                  onClick={() => {
                                    setLabelIds((prev) => isSelected ? prev.filter(id => id !== label.id) : [...prev, label.id]);
                                  }}
                                  className={`w-full flex items-center p-2 rounded-xl transition-all ${
                                    isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-md mr-3 shadow-sm" style={{ backgroundColor: label.color }} />
                                  <div className="flex-1 text-left">
                                    <p className={`text-xs font-black ${isSelected ? 'text-emerald-600' : 'text-slate-700'}`}>{label.name || 'Không tên'}</p>
                                  </div>
                                  {isSelected && <Check className="h-4 w-4 text-emerald-500" />}
                                </button>
                              );
                            })}
                            {filteredLabels.length === 0 && (
                              <div className="px-3 py-2 text-xs font-medium text-slate-400">Không có nhãn phù hợp</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                 </div>

                 <div className="space-y-3 sm:col-span-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Thời hạn</h4>
                    <div className="flex flex-wrap gap-2">
                       {startDate && (
                         <div className="px-4 py-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-[10px] font-black flex items-center shadow-sm">
                            <Calendar className="h-3 w-3 mr-2" />
                            Bắt đầu: {new Date(startDate).toLocaleDateString()}
                         </div>
                       )}
                       {dueDate && (
                         <div className="px-4 py-2 bg-amber-50 border border-amber-100 text-amber-600 rounded-xl text-[10px] font-black flex items-center shadow-sm">
                            <Clock className="h-3 w-3 mr-2" />
                            Kết thúc: {new Date(dueDate).toLocaleDateString()}
                         </div>
                       )}
                       {!startDate && !dueDate && (
                         <div className="px-4 py-2 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl text-[10px] font-bold italic">
                            Chưa thiết lập ngày
                         </div>
                       )}
                    </div>
                 </div>
              </div>
              
              {/* Description */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pr-0 font-black text-slate-800">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <AlignLeft className="h-4 w-4 text-indigo-500" />
                    </div>
                    <h3 className="text-sm tracking-tight uppercase">Mô tả</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDescriptionExpandOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
                    title="Mở màn hình lớn để trình bày nội dung"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Mở rộng
                  </button>
                </div>
                <div className="ml-12 relative group">
                  <div className="prose prose-sm max-w-none w-full border-2 border-transparent group-hover:border-slate-200/80 focus-within:border-indigo-500 rounded-2xl p-4 bg-slate-50 group-hover:bg-slate-100/50 focus-within:bg-white min-h-[180px] transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:shadow-xl focus-within:shadow-indigo-500/5">
                    <EditorJs
                      key={descriptionEditorKey}
                      onInitialize={handleDescriptionInit}
                      onChange={handleDescriptionChange}
                      defaultValue={descriptionDefault}
                      placeholder="Mô tả những gì cần thực hiện..."
                      tools={tools as any}
                    />
                  </div>
                </div>
              </section>

              {/* Checklist */}
              <section className="space-y-4">
                <div className="flex items-center space-x-4 font-black text-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckSquare className="h-4 w-4 text-emerald-500" />
                  </div>
                  <h3 className="text-sm tracking-tight uppercase">Checklist</h3>
                </div>
                <div className="ml-12 space-y-4">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                    <span className="text-xs font-black text-emerald-700">Quản lý danh sách checklist</span>
                    <button
                      type="button"
                      onClick={addChecklistGroup}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tạo checklist mới
                    </button>
                  </div>

                  {checklists.map((group, groupIndex) => (
                    <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={group.title ?? ''}
                          onChange={(e) => updateChecklistTitle(group.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            // Prevent Enter from submitting the whole form while renaming checklist
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                          placeholder={`Tên checklist ${groupIndex + 1}`}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => removeChecklistGroup(group.id)}
                          className="px-3 py-2 text-xs font-bold text-rose-500 hover:text-rose-600"
                        >
                          Xóa list
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={groupIndex === 0}
                            onClick={() => moveChecklistGroup(groupIndex, 'up')}
                            className="p-1.5 rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white"
                            title="Đưa checklist lên trên"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={groupIndex === checklists.length - 1}
                            onClick={() => moveChecklistGroup(groupIndex, 'down')}
                            className="p-1.5 rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white"
                            title="Đưa checklist xuống dưới"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nhập mục checklist rồi Enter"
                          value={group.newItem}
                          onChange={(e) => updateChecklistNewItem(group.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addChecklistItemToGroup(group.id);
                            }
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => addChecklistItemToGroup(group.id)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                        >
                          Thêm mục
                        </button>
                      </div>

                      {group.items.length > 0 && (
                        <div className="space-y-2">
                          {group.items.map((item, index) => (
                            <div key={`${group.id}-${item}-${index}`} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2">
                              <span className="text-sm text-slate-700 font-medium">{item}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => moveChecklistItem(group.id, index, 'up')}
                                  className="p-1 rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                                  title="Đưa mục lên trên"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === group.items.length - 1}
                                  onClick={() => moveChecklistItem(group.id, index, 'down')}
                                  className="p-1 rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                                  title="Đưa mục xuống dưới"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeChecklistItemFromGroup(group.id, index)}
                                  className="text-xs font-bold text-rose-500 hover:text-rose-600 px-2"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Attachments */}
              <section className="space-y-4">
                <div className="flex items-center space-x-4 font-black text-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                    <Paperclip className="h-4 w-4 text-sky-500" />
                  </div>
                  <h3 className="text-sm tracking-tight uppercase">Đính kèm</h3>
                </div>
                <div className="ml-12 space-y-3">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-slate-400" />
                    <input
                      type="url"
                      placeholder="Dán liên kết tệp (tuỳ chọn)"
                      value={attachmentLink}
                      onChange={(e) => setAttachmentLink(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setAttachmentFiles(Array.from(e.target.files || []))}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-700"
                  />
                  {attachmentFiles.length > 0 && (
                    <div className="space-y-1">
                      {attachmentFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="text-xs text-slate-500 font-medium">
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
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
                          <h3 className="text-lg font-black leading-none">Thẻ mới</h3>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Sẵn sàng đưa lên bảng</p>
                       </div>
                    </div>
                    
                    <div className="space-y-4 mb-10">
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Vị trí cột</p>
                          <p className="text-sm font-black text-white">{status === 'PENDING' ? 'Chờ xử lý' : status === 'IN_PROGRESS' ? 'Đang thực hiện' : status === 'DONE' ? 'Hoàn thành' : status === 'WAITING_FOR_DOCUMENT' ? 'Chờ tài liệu' : status === 'DELAYED' ? 'Tạm hoãn' : status === 'APPROVED' ? 'Đã duyệt' : status}</p>
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
                         'Tạo công việc'
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
                    Hủy
                  </button>
               </div>
            </div>

          </div>
        </div>
      </form>
    </div>
    <DescriptionEditorExpandModal
      isOpen={descriptionExpandOpen}
      onClose={() => setDescriptionExpandOpen(false)}
      value={description}
      title="Soạn mô tả công việc"
      onApply={(json) => {
        setDescription(json);
        setDescriptionEditorKey((k) => k + 1);
        setDescriptionExpandOpen(false);
      }}
    />
    </>
  );
}
