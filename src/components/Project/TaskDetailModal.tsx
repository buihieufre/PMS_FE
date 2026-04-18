import { useState, useEffect, useRef } from 'react';
import { format, differenceInSeconds } from 'date-fns';
import { 
  CheckSquare, 
  MessageSquare, 
  Paperclip, 
  X, 
  Trash2, 
  Plus, 
  Clock, 
  ChevronDown,
  User as UserIcon,
  Send,
  AlignLeft,
  MoreVertical,
  Search,
  Check,
  Link
} from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import TaskDatePicker from './TaskDatePicker';
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import axiosInstance from '@/lib/axios';
import AssigneePopover from './AssigneePopover';
import LabelPopover from './LabelPopover';
import ChecklistPopover from './ChecklistPopover';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  projectId: string;
  onUpdate: () => void;
  onDataChange?: (task: any) => void;
}

export default function TaskDetailModal({ isOpen, onClose, task, projectId, onUpdate, onDataChange }: TaskDetailModalProps) {
  const [newComment, setNewComment] = useState('');
  const [localTask, setLocalTask] = useState<any>(task);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task?.title || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState(task?.description || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});
  const [addingToChecklist, setAddingToChecklist] = useState<string | null>(null);
  const { on, off, emit, socket } = useSocket(projectId);
  const { user } = useAuthStore();
  const pendingUpdatesRef = useRef<any>({});
  const updateTimeoutRef = useRef<any>(null);
  const lastUpdateRef = useRef<number>(0);
  const deletingChecklistsRef = useRef<Set<string>>(new Set());
  const checklistToggleTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Persistent Intent Buffer: stores the user's intended state for items/labels.
  // Logic: The local state ALWAYS wins for these IDs until the server matches the intent.
  const intentBufferRef = useRef<Record<string, any>>({});

  const setIntent = (id: string, value: any) => {
    intentBufferRef.current[id] = value;
  };

  const getIntent = (id: string) => intentBufferRef.current[id];

  const clearIntentIfMatches = (id: string, serverValue: any) => {
    if (intentBufferRef.current[id] === serverValue) {
      delete intentBufferRef.current[id];
    }
  };

  const reconcileChecklists = (checklists: any[]) => {
    if (!checklists) return checklists;
    return checklists.map(c => ({
      ...c,
      items: (c.items || []).map((i: any) => {
        const intent = getIntent(i.id);
        if (intent !== undefined) {
          clearIntentIfMatches(i.id, i.isDone);
          return { ...i, isDone: intent };
        }
        return i;
      })
    }));
  };

  const reconcileLabels = (labels: any[]) => {
    if (!labels) return labels;
    const intent = getIntent(`labels-${localTask?.id}`);
    if (intent !== undefined) {
      // For labels, we compare by IDs to see if they match yet
      const serverIds = labels.map(l => l.id).sort().join(',');
      const intentIds = intent.map((l: any) => l.id).sort().join(',');
      if (serverIds === intentIds) {
        delete intentBufferRef.current[`labels-${localTask.id}`];
      }
      return intent;
    }
    return labels;
  };
  
  // Intent-Based Reconciliation: track pending network requests to protect local state
  const inFlightActionsRef = useRef<Record<string, number>>({
    labels: 0,
    checklists: 0,
    assignees: 0,
    title: 0,
    description: 0,
    dueDate: 0
  });

  const incrementInFlight = (field: string) => {
    inFlightActionsRef.current[field] = (inFlightActionsRef.current[field] || 0) + 1;
  };

  const decrementInFlight = (field: string) => {
    inFlightActionsRef.current[field] = Math.max(0, (inFlightActionsRef.current[field] || 0) - 1);
  };

  const isLocked = (field: string) => inFlightActionsRef.current[field] > 0;

  // Deep comparison helper for checklists to avoid redundant renders
  const checklistsAreEqual = (a: any[], b: any[]) => {
    if (a?.length !== b?.length) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  };

  useEffect(() => {
    if (task) {
      setLocalTask((prev: any) => {
        if (!prev) return task;
        return {
          ...task,
          checklists: reconcileChecklists(task.checklists),
          labels: reconcileLabels(task.labels)
        };
      });
      setEditedTitle(task.title);
      setEditedDesc(task.description || '');
    }
  }, [task]);

  useEffect(() => {
    if (!isOpen || !localTask) return;

    // Listen for real-time updates specific to this task
    on('task:updated', (payload: any) => {
      const { task: updatedTask, senderId } = payload || {};
      if (senderId === socket?.id) return;
      if (!updatedTask?.id || !localTask?.id || updatedTask.id !== localTask.id) return;

      setLocalTask((prev: any) => ({
        ...prev,
        ...updatedTask,
        checklists: reconcileChecklists(updatedTask.checklists),
        labels: reconcileLabels(updatedTask.labels)
      }));

      setEditedTitle(updatedTask.title);
      setEditedDesc(updatedTask.description || '');
    });

    on('activity:added', ({ taskId, activity }: any) => {
      if (taskId === localTask.id) {
        setLocalTask((prev: any) => {
          if (prev.activities?.some((a: any) => a.id === activity.id)) return prev;

          // Prevent duplication of optimistic toggle system logs
          if (activity.action === 'TOGGLE_CHECKLIST' && activity.metadata?.itemId) {
            const tempId = `temp-log-toggle-${activity.metadata.itemId}`;
            if (prev.activities?.some((a: any) => a.id === tempId)) {
               return {
                  ...prev,
                  activities: prev.activities.map((a: any) => a.id === tempId ? activity : a)
               };
            }
          }

          return {
            ...prev,
            activities: [activity, ...(prev.activities || [])]
          };
        });
      }
    });

    on('activity:edited', ({ activity }: any) => {
      setLocalTask((prev: any) => ({
        ...prev,
        activities: prev.activities?.map((a: any) => a.id === activity.id ? activity : a)
      }));
    });

    on('activity:deleted', ({ activityId }: any) => {
      setLocalTask((prev: any) => ({
        ...prev,
        activities: prev.activities?.filter((a: any) => a.id !== activityId)
      }));
    });

    on('activity:reacted', ({ activityId, userId, emoji, action }: any) => {
      setLocalTask((prev: any) => ({
        ...prev,
        activities: prev.activities?.map((a: any) => {
          if (a.id === activityId) {
            const newReactions = action === 'added' 
              ? [...(a.reactions || []), { userId, emoji, user: projectMembers.find(m => m.userId === userId)?.user || { displayName: 'Someone' } }]
              : (a.reactions || []).filter((r: any) => !(r.userId === userId && r.emoji === emoji));
            return { ...a, reactions: newReactions };
          }
          return a;
        })
      }));
    });

    // New checklist group events
    on('checklist:created', ({ taskId, checklist }: any) => {
      if (taskId !== localTask.id) return;
      setLocalTask((prev: any) => {
        if (prev.checklists?.some((c: any) => c.id === checklist.id)) return prev;
        const checklists = prev.checklists || [];
        // Replace temp item with same title
        const tempIndex = checklists.findIndex((c: any) => c.id.startsWith('temp-cl-') && c.title === checklist.title);
        if (tempIndex !== -1) {
          const newChecklists = [...checklists];
          newChecklists[tempIndex] = checklist;
          return { ...prev, checklists: newChecklists };
        }
        return { ...prev, checklists: [...checklists, checklist] };
      });
    });

    on('checklist:deleted', ({ taskId, checklistId, senderId }: any) => {
      if (senderId === socket?.id) return;
      if (taskId !== localTask.id) return;
      if (isLocked('checklists')) return;

      setLocalTask((prev: any) => ({
        ...prev,
        checklists: prev.checklists?.filter((c: any) => c.id !== checklistId)
      }));
    });

    on('checklistItem:added', ({ taskId, checklistId, checklistItem }: any) => {
      if (taskId !== localTask.id) return;
      setLocalTask((prev: any) => ({
        ...prev,
        checklists: prev.checklists?.map((c: any) => {
          if (c.id !== checklistId) return c;
          const items = c.items || [];
          // If item with same real ID already exists (from ack callback), skip
          if (items.some((i: any) => i.id === checklistItem.id)) return c;
          // Replace any temp item with the same title (optimistic placeholder)
          const tempIndex = items.findIndex((i: any) => i.id.startsWith('temp-') && i.title === checklistItem.title);
          if (tempIndex !== -1) {
            const newItems = [...items];
            newItems[tempIndex] = checklistItem;
            return { ...c, items: newItems };
          }
          return { ...c, items: [...items, checklistItem] };
        })
      }));
    });

    on('checklistItem:updated', ({ taskId, checklistId, checklistItem, senderId }: any) => {
      if (senderId === socket?.id) return;
      if (taskId !== localTask.id) return;

      // Update the base item then run reconciliation to see if it matches intent
      setLocalTask((prev: any) => {
        const updatedChecklists = prev.checklists?.map((c: any) =>
          c.id === checklistId
            ? { ...c, items: c.items?.map((i: any) => i.id === checklistItem.id ? checklistItem : i) }
            : c
        );
        return {
          ...prev,
          checklists: reconcileChecklists(updatedChecklists)
        };
      });
    });

    on('checklistItem:deleted', ({ taskId, checklistId, itemId, senderId }: any) => {
      if (senderId === socket?.id) return;
      if (taskId !== localTask.id) return;
      if (isLocked('checklists')) return;

      setLocalTask((prev: any) => ({
        ...prev,
        checklists: prev.checklists?.map((c: any) =>
          c.id === checklistId
            ? { ...c, items: c.items?.filter((i: any) => i.id !== itemId) }
            : c
        )
      }));
    });

    return () => {
      off('task:updated');
      off('activity:added');
      off('activity:edited');
      off('activity:deleted');
      off('checklist:created');
      off('checklist:deleted');
      off('checklistItem:added');
      off('checklistItem:updated');
      off('checklistItem:deleted');
      off('task:deleted');
    };
  }, [isOpen, localTask?.id, on, off]);

  useEffect(() => {
    if (isOpen && projectId) {
      const fetchMembers = async () => {
        try {
          const res = await axiosInstance.get(`/projects/${projectId}/members`);
          setProjectMembers(res.data);
        } catch (error) {
          console.error('Error fetching members:', error);
        }
      };
      fetchMembers();
    }
  }, [isOpen, projectId]);

  if (!isOpen || !localTask) return null;

  const handleUpdateTask = async (updates: any) => {
    // Record label intent if updating labels
    if (updates.labels) {
      setIntent(`labels-${localTask.id}`, updates.labels);
    }

    // Optimistic local update
    const optimisticTask = { ...localTask, ...updates };
    setLocalTask(optimisticTask);
    if (onDataChange) onDataChange(optimisticTask);

    // Queue updates for debounce
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
    setIsUpdating(true);

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    
    updateTimeoutRef.current = setTimeout(() => {
      const mergedUpdates = pendingUpdatesRef.current;
      pendingUpdatesRef.current = {}; 
      
      emit('task:update', { taskId: localTask.id, projectId, userId: user?.id, updates: mergedUpdates }, (response: any) => {
        setIsUpdating(false);
        if (response.status === 'error') {
          toast.error(response.message || 'Lỗi cập nhật công việc');
          onUpdate(); 
        } else {
           // Final Sync
           setLocalTask((prev: any) => ({
             ...prev,
             ...response.task,
             checklists: reconcileChecklists(response.task.checklists),
             labels: reconcileLabels(response.task.labels)
           }));
        }
      });
    }, 400);
  };

  // === Checklist Group Handlers ===
  const handleCreateChecklist = (title: string, autoOpenAdd = false) => {
    const tempId = `temp-cl-${Date.now()}`;
    const tempChecklist = { id: tempId, title, items: [] };

    // Optimistic Update
    setLocalTask((prev: any) => {
      const updated = { ...prev, checklists: [...(prev.checklists || []), tempChecklist] };
      if (onDataChange) onDataChange(updated);
      return updated;
    });

    if (autoOpenAdd) {
      setAddingToChecklist(tempId);
    }

    emit('checklist:create', { taskId: localTask.id, projectId, userId: user?.id, title }, (response: any) => {
      if (response.status === 'success') {
        const realChecklist = response.checklist;
        setLocalTask((prev: any) => {
          const updated = {
            ...prev,
            checklists: prev.checklists?.map((c: any) => c.id === tempId ? realChecklist : c)
          };
          if (onDataChange) onDataChange(updated);
          return updated;
        });

        // Also update addingToChecklist if it was opened for the temp id
        setAddingToChecklist(current => current === tempId ? realChecklist.id : current);
      } else {
        toast.error(response.message || 'Không thể tạo danh sách');
        // Rollback
        setLocalTask((prev: any) => {
          const updated = { ...prev, checklists: prev.checklists?.filter((c: any) => c.id !== tempId) };
          if (onDataChange) onDataChange(updated);
          return updated;
        });
        if (autoOpenAdd) setAddingToChecklist(null);
      }
    });
  };

  // Quick function: create a default group then auto-open add-item
  const handleQuickAddItem = () => {
    const checklists = localTask.checklists || [];
    if (checklists.length > 0) {
      // Open the last checklist add-item
      setAddingToChecklist(checklists[checklists.length - 1].id);
    } else {
      // Auto-create default group and open add
      handleCreateChecklist('Checklist', true);
    }
  };

  const handleDeleteChecklist = (checklistId: string, title: string) => {
    // Prevent double-delete (e.g. double click)
    if (deletingChecklistsRef.current.has(checklistId)) return;
    deletingChecklistsRef.current.add(checklistId);
    emit('checklist:delete', { checklistId, projectId, taskId: localTask.id, userId: user?.id, title }, (response: any) => {
      if (response.status === 'error') {
        toast.error(response.message || 'Không thể xóa danh sách');
        onUpdate();
      }
    });
  };

  const handleAddCheckItem = (checklistId: string) => {
    const title = newItemInputs[checklistId]?.trim();
    if (!title) return;

    const tempId = `temp-${Date.now()}`;
    // Optimistic
    setLocalTask((prev: any) => {
      const updated = {
        ...prev,
        checklists: prev.checklists?.map((c: any) =>
          c.id === checklistId
            ? { ...c, items: [...(c.items || []), { id: tempId, title, isDone: false }] }
            : c
        )
      };
      if (onDataChange) onDataChange(updated);
      return updated;
    });
    setNewItemInputs(p => ({ ...p, [checklistId]: '' }));
    setAddingToChecklist(null);

    emit('checklistItem:add', { checklistId, projectId, taskId: localTask.id, userId: user?.id, title }, (response: any) => {
      if (response.status === 'success') {
        // Replace temp with real
        setLocalTask((prev: any) => {
          const updated = {
            ...prev,
            checklists: prev.checklists?.map((c: any) =>
              c.id === checklistId
                ? { ...c, items: c.items?.map((i: any) => i.id === tempId ? response.checklistItem : i) }
                : c
            )
          };
          if (onDataChange) onDataChange(updated);
          return updated;
        });
      } else {
        toast.error(response.message || 'Không thể thêm mục');
        // Remove temp on error
        setLocalTask((prev: any) => ({
          ...prev,
          checklists: prev.checklists?.map((c: any) =>
            c.id === checklistId
              ? { ...c, items: c.items?.filter((i: any) => i.id !== tempId) }
              : c
          )
        }));
      }
    });
  };

  const handleToggleCheckItem = (checklistId: string, itemId: string, currentRenderedIsDone: boolean, title: string) => {
    if (itemId.startsWith('temp-')) return;
    
    let nextIsDone = !currentRenderedIsDone;

    // Record Intent: This item MUST stay this value until server confirms
    setIntent(itemId, nextIsDone);

    // Optimistic Update
    setLocalTask((prev: any) => {
      const updatedChecklists = prev.checklists?.map((c: any) =>
          c.id === checklistId
            ? { ...c, items: c.items?.map((i: any) => i.id === itemId ? { ...i, isDone: nextIsDone } : i) }
            : c
      );
      return { ...prev, checklists: updatedChecklists };
    });

    if (checklistToggleTimeouts.current[itemId]) {
      clearTimeout(checklistToggleTimeouts.current[itemId]);
    }

    checklistToggleTimeouts.current[itemId] = setTimeout(() => {
      emit('checklistItem:toggle', { itemId, checklistId, projectId, taskId: localTask.id, userId: user?.id, isDone: nextIsDone, title }, (response: any) => {
        if (response?.status === 'error') {
          toast.error(response.message || 'Không thể cập nhật mục');
          delete intentBufferRef.current[itemId]; // Clear intent on failure to allow rollback
          onUpdate();
        } else {
          // Verify intent matches response
          clearIntentIfMatches(itemId, response.checklistItem.isDone);
        }
      });
      delete checklistToggleTimeouts.current[itemId];
    }, 400);
  };

  const handleDeleteCheckItem = (checklistId: string, itemId: string) => {
    // Guard: don't delete if no valid id
    if (!itemId || itemId.startsWith('temp-')) return;
    setFieldActionTime('checklists');
    // Optimistic
    setLocalTask((prev: any) => {
      const updated = {
        ...prev,
        checklists: prev.checklists?.map((c: any) =>
          c.id === checklistId
            ? { ...c, items: c.items?.filter((i: any) => i.id !== itemId) }
            : c
        )
      };
      if (onDataChange) onDataChange(updated);
      return updated;
    });

    emit('checklistItem:delete', { itemId, checklistId, projectId, taskId: localTask.id, userId: user?.id }, (response: any) => {
      if (response.status === 'error') {
        toast.error(response.message || 'Không thể xóa mục');
        onUpdate();
      }
    });
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const newActivity = {
      id: tempId,
      type: 'COMMENT',
      action: 'CREATE',
      content: newComment,
      user: user,
      createdAt: new Date().toISOString()
    };

    // Optimistic Update
    setLocalTask((prev: any) => {
      const updatedTask = {
        ...prev,
        activities: [newActivity, ...(prev.activities || [])]
      };
      if (onDataChange) onDataChange(updatedTask);
      return updatedTask;
    });
    setNewComment('');
    lastUpdateRef.current = Date.now();

    emit('activity:add', { taskId: localTask.id, projectId, userId: user?.id, content: newActivity.content }, (response: any) => {
      if (response.status === 'success') {
        // Replace temp with real
        setLocalTask((prev: any) => {
          const updatedTask = {
            ...prev,
            activities: prev.activities?.map((a: any) => a.id === tempId ? response.activity : a) || []
          };
          if (onDataChange) onDataChange(updatedTask);
          return updatedTask;
        });
      } else {
        toast.error(response.message || 'Failed to post comment');
        // Rollback
        setLocalTask((prev: any) => {
          const updatedTask = {
            ...prev,
            activities: prev.activities?.filter((a: any) => a.id !== tempId) || []
          };
          if (onDataChange) onDataChange(updatedTask);
          return updatedTask;
        });
      }
    });
  };

  const handleEditActivity = async (activityId: string) => {
    if (!editingContent.trim()) { setEditingActivityId(null); return; }

    const originalContent = localTask.activities?.find((a: any) => a.id === activityId)?.content;

    // Optimistic Update
    setLocalTask((prev: any) => {
      const updatedTask = {
        ...prev,
        activities: prev.activities?.map((a: any) => 
          a.id === activityId ? { ...a, content: editingContent, isEdited: true } : a
        )
      };
      if (onDataChange) onDataChange(updatedTask);
      return updatedTask;
    });
    setEditingActivityId(null);
    lastUpdateRef.current = Date.now();

    emit('activity:edit', { activityId, projectId, userId: user?.id, content: editingContent }, (res: any) => {
      if (res.status === 'error') {
        toast.error(res.message || 'Failed to edit comment');
        // Rollback
        setLocalTask((prev: any) => {
            const updatedTask = {
                ...prev,
                activities: prev.activities?.map((a: any) => 
                    a.id === activityId ? { ...a, content: originalContent, isEdited: false } : a
                )
            };
            if (onDataChange) onDataChange(updatedTask);
            return updatedTask;
        });
      }
    });
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá bình luận này?')) return;

    const originalActivity = localTask.activities?.find((a: any) => a.id === activityId);

    // Optimistic Update
    setLocalTask((prev: any) => {
      const updatedTask = {
        ...prev,
        activities: prev.activities?.filter((a: any) => a.id !== activityId)
      };
      if (onDataChange) onDataChange(updatedTask);
      return updatedTask;
    });
    lastUpdateRef.current = Date.now();

    emit('activity:delete', { activityId, projectId, userId: user?.id }, (res: any) => {
        if (res && res.status === 'error') {
            toast.error(res.message || 'Failed to delete comment');
            // Rollback
            setLocalTask((prev: any) => {
                let currentActivities = prev.activities || [];
                if (originalActivity) {
                   currentActivities = [originalActivity, ...currentActivities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                }
                const updatedTask = { ...prev, activities: currentActivities };
                if (onDataChange) onDataChange(updatedTask);
                return updatedTask;
            });
        }
    });
  };

  const calculateProgress = (checklist: any) => {
    const items = checklist.items || [];
    if (!items.length) return 0;
    const completed = items.filter((i: any) => i.isDone).length;
    return Math.round((completed / items.length) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto items-start pt-[56px]">
      <Popover as={Fragment}>
        {({ open }) => (
          <div className="bg-[#f1f2f4] w-full max-w-6xl rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.5)] flex flex-col animate-in zoom-in-95 duration-300 text-[#172b4d] relative min-h-[90vh] border border-white/20">
            
            {/* Modal Header */}
            <div className="px-10 py-6 flex justify-between items-start shrink-0 bg-[#f1f2f4] z-20 rounded-t-[32px]">
          <div className="flex-1 pt-2">
            <div className="flex items-center space-x-3 mb-6">
              <div className="relative group">
                <select 
                  value={localTask.status}
                  onChange={(e) => handleUpdateTask({ status: e.target.value })}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black cursor-pointer transition-all flex items-center outline-none shadow-sm uppercase tracking-wider appearance-none pr-8 relative text-slate-600"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }}
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Completed</option>
                  <option value="WAITING_FOR_DOCUMENT">Waiting</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="APPROVED">Approved</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-start space-x-5">
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-sm mt-1 flex items-center justify-center shrink-0">
                 <CheckSquare className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                {isEditingTitle ? (
                  <input 
                    autoFocus
                    className="text-2xl font-black leading-tight bg-white border-2 border-indigo-500 rounded-xl px-4 py-1.5 w-full outline-none shadow-xl shadow-indigo-500/10 animate-in zoom-in-95 duration-75"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={() => {
                      if (editedTitle !== localTask.title) handleUpdateTask({ title: editedTitle });
                      setIsEditingTitle(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editedTitle !== localTask.title) handleUpdateTask({ title: editedTitle });
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                ) : (
                  <h2 
                    onClick={() => setIsEditingTitle(true)}
                    className="text-2xl font-black leading-tight cursor-text hover:bg-slate-200/50 px-3 py-1.5 -ml-3 rounded-xl transition-all"
                  >
                    {localTask.title}
                  </h2>
                )}
                <div className="mt-2 text-xs font-bold text-slate-400 pl-0.5">
                   in list <span className="underline cursor-pointer hover:text-slate-600 transition-all">{localTask.status}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
             <button className="p-2.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm bg-white border border-slate-100"><Paperclip className="h-4.5 w-4.5" /></button>
             <button className="p-2.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm bg-white border border-slate-100"><MoreVertical className="h-4.5 w-4.5" /></button>
             <div className="w-px h-6 bg-slate-300 mx-1" />
             <button onClick={onClose} className="p-2.5 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500 transition-all">
               <X className="h-5 w-5" />
             </button>
          </div>
        </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-full">
            
            {/* Main Content (Left) */}
            <div className="lg:col-span-9 p-10 space-y-12 border-r border-slate-100 bg-white rounded-tl-[48px]">
              
              {/* Task Metadata Row (Labels & Members) */}
              <div className="flex flex-wrap gap-12 items-start pl-8">
                
                {/* Members Section */}
                <div className="space-y-3 max-w-[280px]">
                   <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2 flex items-center gap-2">
                     <UserIcon className="w-3 h-3" />
                     Người thực hiện
                   </h4>
                   <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap -space-x-1.5">
                        {localTask.assignees?.map((a: any) => (
                           <div key={a.id} title={a.displayName} className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden border border-white shadow-sm z-10 hover:z-20 hover:scale-110 transition-transform bg-slate-100">
                              <img src={a.avatarUrl || `https://ui-avatars.com/api/?name=${a.displayName}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                           </div>
                        ))}
                      </div>
                      <AssigneePopover 
                        projectId={projectId}
                        taskId={localTask.id}
                        projectMembers={projectMembers}
                        selectedAssignees={localTask.assignees || []}
                        onUpdate={(newAssigneeIds, updatedAssignees) => {
                           // Let handleUpdateTask manage both the optimistic state update AND the socket emit
                           handleUpdateTask({ assigneeIds: newAssigneeIds, assignees: updatedAssignees });
                        }}
                      />
                   </div>
                </div>

                {/* Labels Section */}
                <div className="space-y-3 max-w-[320px]">
                  <div className="flex items-center justify-between mb-2 h-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nhãn</h4>
                    <LabelPopover 
                      projectId={projectId}
                      taskId={localTask.id}
                      selectedLabels={localTask.labels || []}
                      onUpdate={(newLabelIds, updatedLabels) => {
                         handleUpdateTask({ labelIds: newLabelIds, labels: updatedLabels });
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
                    {localTask.labels?.map((label: any) => (
                      <div key={label.id} title={label.name} className="px-3 rounded-md text-[11px] font-bold text-white shadow-sm h-8 flex items-center cursor-pointer hover:opacity-90" style={{ backgroundColor: label.color }}>
                        {label.name || '\u00A0\u00A0\u00A0\u00A0\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Due Date Overview (if exists) */}
                {(localTask.startDate || localTask.dueDate) && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center h-3">Hạn chót</h4>
                    <div className="flex items-center px-4 h-8 bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-xl text-[11px] font-black text-slate-700 cursor-pointer transition-all shadow-sm gap-3 group">
                      <Clock className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                      <span>{localTask.dueDate && format(new Date(localTask.dueDate), 'dd MMM, HH:mm')}</span>
                      {localTask.dueDate && differenceInSeconds(new Date(localTask.dueDate), new Date()) < 0 ? (
                        <span className="bg-rose-500 text-white px-2 py-0.5 rounded-lg text-[9px] uppercase font-black shadow-lg shadow-rose-200">QUÁ HẠN</span>
                      ) : (
                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-lg text-[9px] uppercase font-black">MỚI</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <section className="space-y-5 pl-8">
                <div className="flex items-center space-x-4 font-black text-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                    <AlignLeft className="h-4 w-4 text-orange-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-tight mb-2">Mô tả công việc</h3>
                </div>
                <div className="ml-12">
                  {isEditingDesc ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <textarea 
                        autoFocus
                        placeholder="Add a more detailed description..."
                        className="w-full bg-white border-2 border-indigo-500 rounded-2xl p-5 text-sm text-slate-700 outline-none transition-all min-h-[180px] font-medium shadow-2xl shadow-indigo-500/5 focus:shadow-indigo-500/10"
                        value={editedDesc}
                        onChange={(e) => setEditedDesc(e.target.value)}
                      />
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => {
                            handleUpdateTask({ description: editedDesc });
                            setIsEditingDesc(false);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-100 active:scale-95"
                        >
                          Lưu lại
                        </button>
                        <button 
                          onClick={() => {
                            setEditedDesc(localTask.description || '');
                            setIsEditingDesc(false);
                          }}
                          className="hover:bg-slate-100 text-slate-500 px-6 py-2 rounded-xl text-xs font-black transition-all"
                        >
                          Hủy bỏ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsEditingDesc(true)}
                      className={`w-full bg-slate-50 hover:bg-slate-100/50 rounded-2xl p-5 text-sm text-slate-700 transition-all min-h-[80px] cursor-pointer border border-transparent hover:border-slate-200 leading-relaxed font-medium ${!localTask.description ? 'text-slate-400 italic' : ''}`}
                    >
                      {localTask.description || 'Thêm mô tả chi tiết hơn để mọi người cùng nắm bắt...'}
                    </div>
                  )}
                </div>
              </section>

              {/* Checklist Groups */}
              {localTask.checklists?.map((checklist: any) => {
                const progress = calculateProgress(checklist);
                return (
                  <section key={checklist.id} className="space-y-4 pl-8">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <CheckSquare className="h-4 w-4 text-emerald-500" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700 flex-1">{checklist.title}</h3>
                      <button
                        onClick={() => handleDeleteChecklist(checklist.id, checklist.title)}
                        className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Xóa
                      </button>
                    </div>

                    <div className="ml-12 space-y-3">
                      {/* Progress Bar */}
                      <div className="flex items-center space-x-3 pr-4">
                        <span className="text-[10px] font-black text-slate-400 w-8 text-right shrink-0">{progress}%</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-0.5 pr-4">
                        {(checklist.items || []).map((item: any) => (
                          <div key={item.id} className="flex items-center group p-2.5 hover:bg-slate-100 rounded-xl transition-all">
                            <input
                              type="checkbox"
                              checked={item.isDone}
                              onChange={() => handleToggleCheckItem(checklist.id, item.id, item.isDone, item.title)}
                              className="w-4 h-4 rounded border-2 border-slate-300 text-emerald-500 cursor-pointer accent-emerald-500"
                            />
                            <span className={`ml-3 text-sm flex-1 transition-all ${
                              item.isDone ? 'line-through text-slate-300' : 'text-slate-700 font-medium'
                            }`}>
                              {item.title}
                            </span>
                            <button
                              onClick={() => handleDeleteCheckItem(checklist.id, item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Item Input */}
                      {addingToChecklist === checklist.id ? (
                        <div className="space-y-2">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Thêm một mục"
                            value={newItemInputs[checklist.id] || ''}
                            onChange={(e) => setNewItemInputs(p => ({ ...p, [checklist.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddCheckItem(checklist.id);
                              if (e.key === 'Escape') setAddingToChecklist(null);
                            }}
                            className="w-full border-2 border-blue-400 rounded-xl px-3 py-2 text-sm focus:outline-none font-medium text-slate-700"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAddCheckItem(checklist.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-4 text-xs rounded-md transition-colors"
                            >
                              Thêm
                            </button>
                            <button
                              onClick={() => setAddingToChecklist(null)}
                              className="text-slate-500 hover:text-slate-700 font-semibold py-1 px-3 text-xs rounded-md transition-colors"
                            >
                              Huỷ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingToChecklist(checklist.id)}
                          className="mt-1 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Thêm một mục
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}

              {/* Comments Area */}
               <section className="pt-12 border-t border-slate-50 pl-8">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center space-x-4 font-black text-slate-800">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-tight mb-2">Hoạt động thảo luận</h3>
                    </div>
                    <button className="text-[10px] px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-black transition-all text-slate-400 uppercase tracking-widest border border-slate-100">
                       Hiện chi tiết
                    </button>
                  </div>

                  <div className="flex space-x-4 mb-10">
                     <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 shadow-sm overflow-hidden mt-1">
                        {user ? (
                           <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                           <UserIcon className="h-4 w-4 text-slate-400" />
                        )}
                     </div>
                     <div className="flex-1 space-y-3">
                        <div className="relative group">
                            <textarea 
                               placeholder="Chia sẻ ý kiến của bạn..."
                               className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-700 hover:shadow-xl hover:shadow-slate-200/50 focus:shadow-xl focus:shadow-indigo-500/5 focus:border-indigo-500 transition-all outline-none min-h-[48px] font-medium resize-none"
                               value={newComment}
                               onChange={(e) => setNewComment(e.target.value)}
                               onFocus={(e) => {
                                 e.target.style.minHeight = '120px';
                                 e.target.closest('.group')?.classList.add('is-focused');
                               }}
                            />
                        </div>
                        {newComment.trim() && (
                          <div className="flex items-center space-x-3 animate-in fade-in slide-in-from-top-1 duration-200">
                             <button 
                               onClick={handleAddComment}
                               className="bg-slate-900 hover:bg-black text-white px-6 py-2 rounded-xl text-xs font-black transition-all shadow-xl shadow-slate-200 active:scale-95"
                             >
                               Gửi bình luận
                             </button>
                             <button 
                               onClick={() => setNewComment('')}
                               className="hover:bg-slate-100 text-slate-500 px-6 py-2 rounded-xl text-xs font-black transition-all"
                             >
                               Hủy
                             </button>
                          </div>
                        )}
                     </div>
                  </div>

                  <div className="space-y-4 ml-0 sm:ml-5">
                     {localTask.activities?.map((activity: any) => {
                        const d = new Date(activity.createdAt);
                        const dateStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate()} thg ${d.getMonth() + 1}, ${d.getFullYear()}`;
                        
                        if (activity.type === 'SYSTEM') {
                           return (
                               <div key={activity.id} className="flex space-x-3 group animate-in fade-in duration-300 items-start">
                                   <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 overflow-hidden shadow-sm mt-0.5">
                                      <img src={`https://ui-avatars.com/api/?name=${activity.user.displayName}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                                   </div>
                                   <div className="flex-1 min-w-0 text-[14px]">
                                      <span className="font-bold text-slate-800 mr-1">{activity.user.displayName}</span>
                                      <span className="text-slate-600">{activity.content}</span>
                                      <div className="text-[11px] text-slate-400 mt-0.5">
                                         {dateStr}
                                      </div>
                                   </div>
                               </div>
                           );
                        }

                        // COMMENT Type
                        return (
                          <div key={activity.id} className="flex space-x-3 group animate-in fade-in duration-300">
                             <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                <img src={`https://ui-avatars.com/api/?name=${activity.user.displayName}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                   <span className="text-[14px] font-bold text-slate-800">{activity.user.displayName}</span>
                                   <span className="text-[12px] text-slate-500 hover:text-slate-800 cursor-pointer transition-colors" title={dateStr}>
                                      {dateStr}
                                   </span>
                                   {activity.isEdited && <span className="text-[12px] text-slate-400">(đã sửa)</span>}
                                </div>
                                
                                {editingActivityId === activity.id ? (
                                  <div className="space-y-2 mt-2">
                                     <textarea 
                                        className="w-full bg-white border border-slate-300 rounded-[12px] p-3 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[60px]"
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        autoFocus
                                     />
                                     <div className="flex space-x-2">
                                        <button onClick={() => handleEditActivity(activity.id)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[13px] transition-colors">
                                           Lưu
                                        </button>
                                        <button onClick={() => setEditingActivityId(null)} className="px-4 py-1.5 hover:bg-slate-100 text-slate-600 font-bold rounded text-[13px] transition-colors">
                                           Hủy
                                        </button>
                                     </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="p-3 bg-white border border-slate-200 rounded-tr-[12px] rounded-b-[12px] text-[14px] text-slate-800 leading-relaxed shadow-sm shadow-slate-100 mb-1 inline-block min-w-[50%]">
                                       {activity.content}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pl-1 mt-1">
                                       <Popover className="relative">
                                          <Popover.Button className="text-[12px] font-medium text-slate-500 hover:text-slate-800 underline transition-colors outline-none cursor-pointer">
                                             😄
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
                                            <Popover.Panel className="absolute z-[60] bottom-full mb-2 left-0 bg-white shadow-xl border border-slate-100 rounded-xl p-1.5 flex space-x-1">
                                              {['👍', '❤️', '😂', '👀', '🎉'].map(emoji => (
                                                <button 
                                                  key={emoji}
                                                  onClick={() => emit('activity:react', { activityId: activity.id, projectId, userId: user?.id, emoji })}
                                                  className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-lg transition-colors"
                                                >
                                                  {emoji}
                                                </button>
                                              ))}
                                            </Popover.Panel>
                                          </Transition>
                                       </Popover>

                                       {activity.reactions && activity.reactions.length > 0 && (
                                         <div className="flex items-center space-x-1.5 ml-1">
                                            {Array.from(new Set(activity.reactions.map((r: any) => r.emoji))).map((emoji: any) => {
                                              const count = activity.reactions.filter((r: any) => r.emoji === emoji).length;
                                              const hasReacted = activity.reactions.some((r: any) => r.emoji === emoji && r.userId === user?.id);
                                              const usersWhoReacted = activity.reactions.filter((r: any) => r.emoji === emoji).map((r: any) => r.user?.displayName).join(', ');
                                              
                                              return (
                                                <button 
                                                  key={emoji as string}
                                                  title={usersWhoReacted}
                                                  onClick={() => emit('activity:react', { activityId: activity.id, projectId, userId: user?.id, emoji })}
                                                  className={`flex items-center justify-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold transition-all border ${hasReacted ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                                >
                                                  <span className="text-[12px] leading-none">{emoji as string}</span>
                                                  <span className="leading-none mt-px">{count}</span>
                                                </button>
                                              )
                                            })}
                                         </div>
                                       )}

                                       <span className="text-slate-300 text-[10px] mx-1">•</span>
                                       {user?.id === activity.user.id && (
                                         <>
                                           <button onClick={() => { setEditingActivityId(activity.id); setEditingContent(activity.content); }} className="text-[12px] font-medium text-slate-500 hover:text-slate-800 underline transition-colors">
                                              Chỉnh sửa
                                           </button>
                                           <span className="text-slate-300 text-[10px]">•</span>
                                           <button onClick={() => handleDeleteActivity(activity.id)} className="text-[12px] font-medium text-slate-500 hover:text-slate-800 underline transition-colors">
                                              Xoá
                                           </button>
                                         </>
                                       )}
                                    </div>
                                  </>
                                )}
                             </div>
                          </div>
                        );
                      })}
                  </div>
               </section>
            </div>

            {/* Side Content (Right) - ACTIONS Sidebar */}
            <div className="lg:col-span-3 p-8 space-y-8 bg-slate-50/20 rounded-tr-[48px]">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Thao tác thẻ</h4>
                
                {/* Checklist Buttons */}
                <ChecklistPopover onAdd={(title) => handleCreateChecklist(title)} />
                <button
                  onClick={handleQuickAddItem}
                  className="w-full px-4 py-2.5 bg-white border border-slate-100 hover:bg-slate-50 rounded-2xl text-xs font-bold flex items-center transition-all shadow-sm text-slate-500"
                >
                  <Plus className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Thêm mục nhanh
                </button>

                {/* Dates Button */}
                <div className="relative">
                  <Popover>
                    {({ open, close }) => (
                      <>
                        <Popover.Button
                          className={`w-full px-4 py-3 rounded-2xl text-xs font-black flex items-center transition-all border shadow-lg ${
                            open ? 'bg-amber-500 border-amber-500 text-white shadow-amber-200' : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-600 shadow-slate-100/50'
                          }`}
                        >
                          <Clock className="h-4 w-4 mr-3" /> Chỉnh sửa thời hạn
                        </Popover.Button>

                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-300"
                          enterFrom="opacity-0 translate-x-4"
                          enterTo="opacity-100 translate-x-0"
                          leave="transition ease-in duration-150"
                        >
                          <Popover.Panel className="absolute z-[110] top-0 right-[calc(100%+16px)] w-max">
                            <TaskDatePicker 
                              isOpen={open}
                              onClose={close}
                              initialStartDate={localTask.startDate}
                              initialDueDate={localTask.dueDate}
                              initialReminderOffset={localTask.reminderOffset}
                              onSave={(data) => {
                                handleUpdateTask(data);
                                close();
                              }}
                              onRemove={() => {
                                handleUpdateTask({ startDate: null, dueDate: null, reminderOffset: null });
                              }}
                            />
                          </Popover.Panel>
                        </Transition>
                      </>
                    )}
                  </Popover>
                </div>

                {/* Attachment Button */}
                <button className="w-full px-4 py-3 bg-white border border-slate-100 hover:bg-slate-50 rounded-2xl text-xs font-black flex items-center transition-all shadow-lg shadow-slate-100/50 text-slate-600">
                   <Paperclip className="h-4 w-4 mr-3 text-slate-400" /> Đính kèm tệp
                </button>
              </div>

              {/* Actions Section */}
              <div className="space-y-4 pt-8 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Phím tắt thao tác</h4>
                <button className="w-full px-4 py-3 bg-white border border-slate-100 hover:bg-slate-50 text-slate-600 rounded-2xl text-xs font-black flex items-center transition-all shadow-sm">
                   Di chuyển thẻ
                </button>
                <button className="w-full px-4 py-3 bg-white border border-slate-100 hover:bg-slate-50 text-slate-600 rounded-2xl text-xs font-black flex items-center transition-all shadow-sm">
                   Sao chép thẻ
                </button>
                <button 
                   onClick={() => handleUpdateTask({ status: 'DONE' })}
                   className="w-full px-4 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black flex items-center justify-center transition-all border-none shadow-xl shadow-emerald-100 active:scale-95"
                >
                   Đánh dấu hoàn thành
                </button>
                <button 
                   className="w-full px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-2xl text-xs font-black flex items-center justify-center transition-all border-none shadow-sm"
                >
                   Hủy bỏ thẻ (Xóa)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Popover>
  </div>
);
}
