import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getEditorTools } from '@/lib/editorTools';
import { parseTaskDescriptionData, taskDescriptionHasContent } from '@/lib/taskDescription';
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
  Link as LinkIcon,
  Eye,
  Maximize2,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useSocket, getSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import TaskDatePicker from './TaskDatePicker';
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { createPortal } from 'react-dom';
import axiosInstance from '@/lib/axios';
import AssigneePopover from './AssigneePopover';
import LabelPopover from './LabelPopover';
import ChecklistPopover from './ChecklistPopover';
import AttachmentPopover from './AttachmentPopover';
import { TaskAppearancePopover } from './TaskAppearancePopover';
import { getCoverStripStyle, isTaskCoverImageUrl } from '@/lib/boardBackgroundStyle';
import { ExternalLink, Download, FileVideo, FileText, FileImage, FileCode, File as FileIcon } from 'lucide-react';
import ConfirmModal from '@/components/Modal/ConfirmModal';
import DescriptionEditorExpandModal from '@/components/Modal/DescriptionEditorExpandModal';
import { CopyTaskCardForm, type CopyTaskBoardTaskRef } from './CopyTaskCardForm';
import type { BoardTask } from './TaskCardFace';

const EditorJs = dynamic(
  () => import('react-editor-js').then((mod) => mod.createReactEditorJS()),
  { ssr: false }
);
const EditorJsViewer = dynamic(
  () => import('react-editor-js').then((mod) => mod.createReactEditorJS()),
  { ssr: false }
);

/** Icon “Thêm cảm xúc” kiểu Facebook: mặt cười viền + vòng tròn nhỏ có dấu + */
function AddReactionGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="6.9" cy="7.6" r="0.7" fill="currentColor" />
      <circle cx="11.1" cy="7.6" r="0.7" fill="currentColor" />
      <path
        d="M6.2 10.5c0.6 1.7 2.1 2.8 3.7 2.8s3.1-1 3.8-2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="16.2" cy="15.8" r="4.2" fill="currentColor" />
      <path
        d="M16.2 13.6v4.4M14 16.2h4.4"
        stroke="white"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Activity log id from DB is UUID; optimistic comments use `temp-...` and must not hit the API */
const ACTIVITY_UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isPersistedActivityId(id: unknown): id is string {
  return typeof id === 'string' && ACTIVITY_UUID_RE.test(id);
}

/** Chỉ dòng thời gian: bình luận + hệ thống thêm/xóa/đính kèm; cập nhật/diễn giải khác xem khi bật chi tiết */
const SYSTEM_ACTIONS_IN_COMPACT = new Set([
  'ADD_CHECKLIST_GROUP',
  'DELETE_CHECKLIST_GROUP',
  'DELETE_CHECKLIST',
  'ATTACH_FILE',
  'DELETE_ATTACH'
]);

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  projectId: string;
  projectName: string;
  boardTasks: CopyTaskBoardTaskRef[];
  onOptimisticTaskCopy?: (args: {
    tempId: string;
    title: string;
    status: string;
    position: number;
    sourceTask: BoardTask;
  }) => void;
  onCopyTaskConfirm?: (tempId: string, task: BoardTask) => void;
  onCopyTaskRollback?: (tempId: string, message?: string) => void;
  onUpdate: () => void;
  onDataChange?: (task: any) => void;
  /** Thành viên từ trang board — đồng bộ mention/danh sách ngay, không cần chỉ fetch trong modal */
  projectMembersList?: any[];
}

function TaskCoverMenuButton({
  projectId,
  taskId,
  localTask,
  onUpdate,
  variant = 'default',
}: {
  projectId: string;
  taskId: string;
  localTask: any;
  onUpdate: (d: any) => void;
  variant?: 'default' | 'onCover';
}) {
  const onCover = variant === 'onCover';
  return (
    <Popover className="relative">
      <Popover.Button
        className={
          onCover
            ? 'inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-black/20 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-sm transition-colors hover:border-white/55 hover:bg-black/30'
            : 'inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-sm hover:bg-white'
        }
      >
        <ImageIcon className={`h-3.5 w-3.5 ${onCover ? 'text-white' : 'text-slate-500'}`} />
        Thay đổi bìa
      </Popover.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <Popover.Panel
          className="absolute left-0 z-[200] mt-2 w-max max-w-[min(100vw-1.5rem,22.5rem)]"
        >
          <TaskAppearancePopover
            currentBackground={localTask.background || undefined}
            currentTextColor={localTask.textColor || undefined}
            currentCoverMode={localTask.coverMode}
            projectId={projectId}
            taskId={taskId}
            onUpdate={onUpdate}
          />
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}

export default function TaskDetailModal({
  isOpen,
  onClose,
  task,
  projectId,
  projectName,
  boardTasks,
  onOptimisticTaskCopy,
  onCopyTaskConfirm,
  onCopyTaskRollback,
  onUpdate,
  onDataChange,
  projectMembersList,
}: TaskDetailModalProps) {
  const [newComment, setNewComment] = useState('');
  const [localTask, setLocalTask] = useState<any>(task);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task?.title || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState(task?.description || '');
  const [descEditSessionKey, setDescEditSessionKey] = useState(0);
  const [descriptionExpandOpen, setDescriptionExpandOpen] = useState(false);
  const descEditorRef = useRef<any>(null);
  const descEditorTools = useMemo(() => getEditorTools(), []);
  const descEditDefault = useMemo(
    () => parseTaskDescriptionData(editedDesc),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount khi bật sửa / phiên sửa mới, không theo từng ký tự
    [descEditSessionKey, isEditingDesc]
  );
  const handleDescEditorInit = useCallback((core: any) => {
    descEditorRef.current = core;
  }, []);
  const handleDescEditorChange = useCallback(async () => {
    if (!descEditorRef.current) return;
    try {
      const data = await descEditorRef.current.save();
      setEditedDesc(JSON.stringify(data));
    } catch {
      // ignore
    }
  }, []);
  const [isUpdating, setIsUpdating] = useState(false);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});
  const [addingToChecklist, setAddingToChecklist] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
  const [deletingAttachmentIds, setDeletingAttachmentIds] = useState<Set<string>>(new Set());
  const [checklistToDelete, setChecklistToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistTitle, setEditingChecklistTitle] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  /** false = gọn: tin nhắn + thêm/xóa; true = tất cả (UPDATE, tick checklist, v.v.) */
  const [showFullActivityLog, setShowFullActivityLog] = useState(false);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const { emit, socket } = useSocket(projectId);
  const { user } = useAuthStore();
  const pendingUpdatesRef = useRef<any>({});
  const updateTimeoutRef = useRef<any>(null);
  const lastUpdateRef = useRef<number>(0);
  const deletingChecklistsRef = useRef<Set<string>>(new Set());
  const checklistToggleTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastCommentSubmitRef = useRef<{ content: string; at: number } | null>(null);
  const EMOJI_OPTIONS = ['👍', '❤️', '😂', '👀', '🎉'];

  const toMentionHandle = (member: any) => {
    const employeeCode = String(member?.user?.employeeCode || '').trim().replace(/^@/, '');
    if (employeeCode) return employeeCode;
    const displayName = String(member?.user?.displayName || '');
    return displayName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');
  };

  const mentionCandidates = projectMembers
    .filter((m: any) => m?.user?.id && m.user.id !== user?.id)
    .map((m: any) => ({
      member: m,
      userId: m.user.id,
      displayName: m.user.displayName || 'Unknown',
      employeeCode: m.user.employeeCode || '',
      handle: toMentionHandle(m)
    }))
    .filter((x: any) => x.handle);

  const filteredMentionCandidates = mentionCandidates
    .filter((x: any) => {
      const query = mentionQuery.toLowerCase();
      if (!query) return true;
      return (
        x.handle.toLowerCase().includes(query) ||
        x.displayName.toLowerCase().includes(query) ||
        String(x.employeeCode || '').toLowerCase().replace(/^@/, '').includes(query)
      );
    })
    .slice(0, 8);

  const activitiesSource = localTask?.activities;
  const displayedActivities = useMemo(() => {
    const list = Array.isArray(activitiesSource) ? activitiesSource : [];
    if (showFullActivityLog) return list;
    return list.filter((a: any) => {
      if (a.type === 'COMMENT') return true;
      if (a.type === 'SYSTEM' && a.action && SYSTEM_ACTIONS_IN_COMPACT.has(a.action)) return true;
      return false;
    });
  }, [activitiesSource, showFullActivityLog]);

  const allActivityCount = Array.isArray(activitiesSource) ? activitiesSource.length : 0;
  const hasMoreActivitiesThanCompact =
    allActivityCount > 0 && displayedActivities.length < allActivityCount;

  useEffect(() => {
    setShowFullActivityLog(false);
  }, [task?.id]);

  useEffect(() => {
    setIsCopyModalOpen(false);
  }, [task?.id, isOpen]);

  const updateMentionState = (value: string, caretPos: number) => {
    const beforeCaret = value.slice(0, caretPos);
    const match = beforeCaret.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (!match) {
      setIsMentionOpen(false);
      setMentionQuery('');
      setMentionStart(null);
      return;
    }

    const atIndex = beforeCaret.lastIndexOf('@');
    if (atIndex < 0) {
      setIsMentionOpen(false);
      setMentionQuery('');
      setMentionStart(null);
      return;
    }

    setMentionStart(atIndex);
    setMentionQuery(match[2] || '');
    setActiveMentionIndex(0);
    setIsMentionOpen(true);
  };

  const applyMention = (handle: string) => {
    const textarea = commentTextareaRef.current;
    if (!textarea || mentionStart === null) return;

    const caretPos = textarea.selectionStart ?? newComment.length;
    const before = newComment.slice(0, mentionStart);
    const after = newComment.slice(caretPos);
    const inserted = `@${handle} `;
    const next = `${before}${inserted}${after}`;

    setNewComment(next);
    setIsMentionOpen(false);
    setMentionQuery('');
    setMentionStart(null);

    const nextCaretPos = before.length + inserted.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaretPos, nextCaretPos);
    });
  };
  
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
    if (!isOpen || !localTask || typeof window === 'undefined') return;
    const s = getSocket();
    if (!s) return;
    const taskId = localTask.id;
    const subs: { ev: string; fn: (data: any) => void }[] = [];
    const add = (ev: string, fn: (data: any) => void) => {
      s.on(ev, fn);
      subs.push({ ev, fn });
    };

    add('task:updated', (payload: any) => {
      const updatedTask = payload?.task || payload;
      const senderId = payload?.senderId;
      if (senderId === s.id) return;
      if (!updatedTask?.id || !taskId || updatedTask.id !== taskId) return;

      setLocalTask((prev: any) => ({
        ...prev,
        ...updatedTask,
        checklists: reconcileChecklists(updatedTask.checklists),
        labels: reconcileLabels(updatedTask.labels)
      }));

      setEditedTitle(updatedTask.title);
      setEditedDesc(updatedTask.description || '');
    });

    add('activity:added', ({ taskId: tid, activity }: any) => {
      if (tid === taskId) {
        setLocalTask((prev: any) => {
          const currentActivities = prev.activities || [];
          if (currentActivities.some((a: any) => a.id === activity.id)) return prev;

          if (activity.action === 'TOGGLE_CHECKLIST' && activity.metadata?.itemId) {
            const tempId = `temp-log-toggle-${activity.metadata.itemId}`;
            if (currentActivities.some((a: any) => a.id === tempId)) {
              return {
                ...prev,
                activities: currentActivities.map((a: any) => (a.id === tempId ? activity : a))
              };
            }
          }

          const tempCommentIndex = currentActivities.findIndex(
            (a: any) =>
              String(a.id || '').startsWith('temp-') &&
              a.type === 'COMMENT' &&
              a.user?.id === activity.user?.id &&
              String(a.content || '').trim() === String(activity.content || '').trim()
          );

          const nextActivities =
            tempCommentIndex >= 0
              ? currentActivities.map((a: any, idx: number) => (idx === tempCommentIndex ? activity : a))
              : [activity, ...currentActivities];

          const seen = new Set<string>();
          const dedupedActivities = nextActivities.filter((a: any) => {
            if (!a?.id) return true;
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          });

          return {
            ...prev,
            activities: dedupedActivities
          };
        });
      }
    });

    add('activity:edited', ({ activity }: any) => {
      setLocalTask((prev: any) => ({
        ...prev,
        activities: prev.activities?.map((a: any) => (a.id === activity.id ? activity : a))
      }));
    });

    add('activity:deleted', ({ activityId }: any) => {
      setLocalTask((prev: any) => ({
        ...prev,
        activities: prev.activities?.filter((a: any) => a.id !== activityId)
      }));
    });

    add('activity:reacted', ({ activityId, userId, emoji, action }: any) => {
      setLocalTask((prev: any) => ({
        ...prev,
        activities: prev.activities?.map((a: any) => {
          if (a.id === activityId) {
            const newReactions =
              action === 'added'
                ? [
                    ...(a.reactions || []),
                    {
                      userId,
                      emoji,
                      user: projectMembers.find((m) => m.userId === userId)?.user || { displayName: 'Someone' }
                    }
                  ]
                : (a.reactions || []).filter((r: any) => !(r.userId === userId && r.emoji === emoji));
            return { ...a, reactions: newReactions };
          }
          return a;
        })
      }));
    });

    add('checklist:created', ({ taskId: tid, checklist }: any) => {
      if (tid !== taskId) return;
      setLocalTask((prev: any) => {
        if (prev.checklists?.some((c: any) => c.id === checklist.id)) return prev;
        const checklists = prev.checklists || [];
        const tempIndex = checklists.findIndex(
          (c: any) => c.id.startsWith('temp-cl-') && c.title === checklist.title
        );
        if (tempIndex !== -1) {
          const newChecklists = [...checklists];
          newChecklists[tempIndex] = checklist;
          return { ...prev, checklists: newChecklists };
        }
        return { ...prev, checklists: [...checklists, checklist] };
      });
    });

    add('checklist:deleted', ({ taskId: tid, checklistId, senderId }: any) => {
      if (senderId === s.id) return;
      if (tid !== taskId) return;
      if (isLocked('checklists')) return;

      setLocalTask((prev: any) => ({
        ...prev,
        checklists: prev.checklists?.filter((c: any) => c.id !== checklistId)
      }));
    });

    add('checklistItem:added', ({ taskId: tid, checklistId, checklistItem }: any) => {
      if (tid !== taskId) return;
      setLocalTask((prev: any) => ({
        ...prev,
        checklists: prev.checklists?.map((c: any) => {
          if (c.id !== checklistId) return c;
          const items = c.items || [];
          if (items.some((i: any) => i.id === checklistItem.id)) return c;
          const tempIndex = items.findIndex(
            (i: any) => i.id.startsWith('temp-') && i.title === checklistItem.title
          );
          if (tempIndex !== -1) {
            const newItems = [...items];
            newItems[tempIndex] = checklistItem;
            return { ...c, items: newItems };
          }
          return { ...c, items: [...items, checklistItem] };
        })
      }));
    });

    add('checklistItem:updated', ({ taskId: tid, checklistId, checklistItem, senderId }: any) => {
      if (senderId === s.id) return;
      if (tid !== taskId) return;

      setLocalTask((prev: any) => {
        const updatedChecklists = prev.checklists?.map((c: any) =>
          c.id === checklistId
            ? { ...c, items: c.items?.map((i: any) => (i.id === checklistItem.id ? checklistItem : i)) }
            : c
        );
        return {
          ...prev,
          checklists: reconcileChecklists(updatedChecklists)
        };
      });
    });

    add('checklistItem:deleted', ({ taskId: tid, checklistId, itemId, senderId }: any) => {
      if (senderId === s.id) return;
      if (tid !== taskId) return;
      if (isLocked('checklists')) return;

      setLocalTask((prev: any) => ({
        ...prev,
        checklists: prev.checklists?.map((c: any) =>
          c.id === checklistId ? { ...c, items: c.items?.filter((i: any) => i.id !== itemId) } : c
        )
      }));
    });

    add('attachment:added', ({ taskId: tid, attachment }: any) => {
      if (tid === taskId) {
        setLocalTask((prev: any) => ({
          ...prev,
          attachments: [attachment, ...(prev.attachments || [])]
        }));
      }
    });

    add('attachment:deleted', ({ taskId: tid, attachmentId }: any) => {
      if (tid === taskId) {
        setLocalTask((prev: any) => ({
          ...prev,
          attachments: prev.attachments?.filter((a: any) => a.id !== attachmentId)
        }));
      }
    });

    return () => {
      subs.forEach(({ ev, fn }) => s.off(ev, fn));
    };
  }, [isOpen, localTask?.id, projectMembers]);

  useEffect(() => {
    if (projectMembersList && projectMembersList.length > 0) {
      setProjectMembers(projectMembersList);
    }
  }, [projectMembersList]);

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

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const emitTaskUpdate = (updates: any) => {
    emit('task:update', { taskId: localTask.id, projectId, userId: user?.id, updates }, (response: any) => {
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
  };

  const handleUpdateTask = async (updates: any) => {
    // Record label intent if updating labels
    if (updates.labels !== undefined) {
      setIntent(`labels-${localTask.id}`, updates.labels);
    }

    // Optimistic local update
    const optimisticTask = { ...localTask, ...updates };
    setLocalTask(optimisticTask);
    if (onDataChange) onDataChange(optimisticTask);

    // Bìa tạm từ chọn file (blob:) — hiển thị ngay, không debounce/emit; URL thật sẽ gọi lại khi upload xong
    if (updates.background !== undefined && String(updates.background).startsWith('blob:')) {
      return;
    }

    setIsUpdating(true);

    // Labels should update immediately (no debounce) to avoid UI flicker/jump.
    const isLabelUpdate = updates.labelIds !== undefined || updates.labels !== undefined;
    if (isLabelUpdate) {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      pendingUpdatesRef.current = {};
      emitTaskUpdate(updates);
      return;
    }

    // Queue non-label updates for debounce
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      const mergedUpdates = pendingUpdatesRef.current;
      pendingUpdatesRef.current = {};
      emitTaskUpdate(mergedUpdates);
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

  const requestDeleteChecklist = (checklistId: string, title: string) => {
    setChecklistToDelete({ id: checklistId, title });
  };

  const confirmDeleteChecklist = () => {
    if (!checklistToDelete) return;
    handleDeleteChecklist(checklistToDelete.id, checklistToDelete.title);
    setChecklistToDelete(null);
  };

  const startEditChecklistTitle = (checklistId: string, currentTitle: string) => {
    setEditingChecklistId(checklistId);
    setEditingChecklistTitle(currentTitle || '');
  };

  const cancelEditChecklistTitle = () => {
    setEditingChecklistId(null);
    setEditingChecklistTitle('');
  };

  const saveChecklistTitle = async (checklistId: string) => {
    const trimmed = editingChecklistTitle.trim();
    if (!trimmed) {
      toast.error('Tên checklist không được để trống');
      return;
    }

    setLocalTask((prev: any) => {
      const updated = {
        ...prev,
        checklists: prev.checklists?.map((c: any) => (c.id === checklistId ? { ...c, title: trimmed } : c))
      };
      if (onDataChange) onDataChange(updated);
      return updated;
    });

    cancelEditChecklistTitle();

    try {
      await axiosInstance.patch(`/projects/${projectId}/tasks/${localTask.id}/checklists/${checklistId}`, { title: trimmed });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể đổi tên checklist');
      onUpdate();
    }
  };

  const handleAddCheckItem = (checklistId: string) => {
    if (checklistId.startsWith('temp-')) {
      toast.info('Danh sách đang được lưu, vui lòng đợi giây lát...');
      return;
    }
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
    const trimmedComment = newComment.trim();
    if (!trimmedComment || isSubmittingComment) return;

    const now = Date.now();
    const lastSubmit = lastCommentSubmitRef.current;
    if (lastSubmit && lastSubmit.content === trimmedComment && now - lastSubmit.at < 1200) {
      return;
    }
    lastCommentSubmitRef.current = { content: trimmedComment, at: now };
    setIsSubmittingComment(true);

    const tempId = `temp-${Date.now()}`;
    const newActivity = {
      id: tempId,
      type: 'COMMENT',
      action: 'CREATE',
      content: trimmedComment,
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
      setIsSubmittingComment(false);
      if (response.status === 'success') {
        // Replace temp with real and dedupe (socket event may arrive before callback).
        setLocalTask((prev: any) => {
          const baseActivities = prev.activities || [];
          const replaced = baseActivities.map((a: any) => a.id === tempId ? response.activity : a);
          const alreadyHasReal = replaced.some((a: any) => a.id === response.activity.id);
          const nextList = alreadyHasReal ? replaced : [response.activity, ...replaced];

          const seen = new Set<string>();
          const deduped = nextList.filter((a: any) => {
            if (!a?.id) return true;
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          });

          const updatedTask = {
            ...prev,
            activities: deduped
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

  useEffect(() => {
    if (!isMentionOpen) return;
    if (filteredMentionCandidates.length === 0) {
      setActiveMentionIndex(0);
      return;
    }
    if (activeMentionIndex > filteredMentionCandidates.length - 1) {
      setActiveMentionIndex(0);
    }
  }, [isMentionOpen, filteredMentionCandidates.length, activeMentionIndex]);

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

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (deletingAttachmentIds.has(attachmentId)) return;
    if (!confirm('Bạn có chắc chắn muốn gỡ bỏ tệp đính kèm này?')) return;

    const previousAttachments = localTask.attachments || [];
    const nextAttachments = previousAttachments.filter((a: any) => a.id !== attachmentId);
    setDeletingAttachmentIds((prev) => new Set(prev).add(attachmentId));

    // Optimistic remove: update UI immediately for faster feedback.
    setLocalTask((prev: any) => {
      const updatedTask = {
        ...prev,
        attachments: (prev.attachments || []).filter((a: any) => a.id !== attachmentId)
      };
      if (onDataChange) onDataChange(updatedTask);
      return updatedTask;
    });

    if (previewAttachment?.id === attachmentId) {
      setPreviewAttachment(null);
    }

    try {
      await axiosInstance.delete(`/projects/${projectId}/tasks/${localTask.id}/attachments/${attachmentId}`);
      toast.success('Đã gỡ bỏ tệp đính kèm');
    } catch (error: any) {
      // Rollback if API fails
      setLocalTask((prev: any) => {
        const updatedTask = { ...prev, attachments: previousAttachments };
        if (onDataChange) onDataChange(updatedTask);
        return updatedTask;
      });
      toast.error(error?.response?.data?.message || 'Lỗi khi xóa tệp đính kèm');
    } finally {
      setDeletingAttachmentIds((prev) => {
        const next = new Set(prev);
        next.delete(attachmentId);
        return next;
      });
    }
  };

  const calculateProgress = (checklist: any) => {
    const items = checklist.items || [];
    if (!items.length) return 0;
    const completed = items.filter((i: any) => i.isDone).length;
    return Math.round((completed / items.length) * 100);
  };

  const formatAttachmentSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleCommentAttachment = () => {
    toast.info('Tính năng nhận xét tệp sẽ được bổ sung sớm');
  };

  const getAttachmentExtension = (attachment: any) => {
    const name = attachment?.fileName || '';
    const ext = name.split('.').pop();
    return ext ? ext.toLowerCase() : '';
  };

  const getAttachmentTypeBadge = (attachment: any) => {
    const ext = getAttachmentExtension(attachment);
    if (!ext) return 'FILE';

    if (['doc', 'docx'].includes(ext)) return 'WORD';
    if (['xls', 'xlsx'].includes(ext)) return 'EXCEL';
    if (['ppt', 'pptx'].includes(ext)) return 'PPT';
    if (ext === 'pdf') return 'PDF';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return ext.toUpperCase();
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return ext.toUpperCase();
    if (['txt', 'md', 'csv', 'json', 'xml'].includes(ext)) return ext.toUpperCase();
    if (ext.length > 5) return `${ext.slice(0, 5).toUpperCase()}+`;
    return ext.toUpperCase();
  };

  const getAttachmentPreviewType = (attachment: any) => {
    const mime = attachment?.mimetype || '';
    const ext = getAttachmentExtension(attachment);

    if (!attachment?.fileSize) return 'link';
    if (mime.includes('image')) return 'image';
    if (mime.includes('video')) return 'video';
    if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
    if (['txt', 'md', 'csv', 'json', 'xml'].includes(ext)) return 'text';
    return 'unknown';
  };

  const getEmbedPreviewUrl = (attachment: any) => {
    const previewType = getAttachmentPreviewType(attachment);
    const fileUrl = attachment?.fileUrl || '';
    if (!fileUrl) return '';

    if (previewType === 'office') {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
    }

    if (previewType === 'link') {
      return fileUrl;
    }

    return fileUrl;
  };

  const isPreviewableAttachment = (attachment: any) => {
    const previewType = getAttachmentPreviewType(attachment);
    return previewType !== 'unknown';
  };

  const handlePreviewAttachment = (attachment: any) => {
    if (!attachment?.fileUrl) {
      toast.error('Không tìm thấy đường dẫn tệp để xem trước');
      return;
    }

    if (!isPreviewableAttachment(attachment)) {
      window.open(attachment.fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setPreviewAttachment(attachment);
  };

  useEffect(() => {
    if (!previewAttachment) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewAttachment]);

  const handleReactionClick = (activity: any, emoji: string) => {
    if (!isPersistedActivityId(activity?.id)) {
      toast.message('Chờ bình luận được lưu xong rồi mới thả cảm xúc.');
      return;
    }
    const currentUserReactions = (activity.reactions || []).filter((r: any) => r.userId === user?.id);
    const hasSame = currentUserReactions.some((r: any) => r.emoji === emoji);

    // Click same emoji again => remove.
    if (hasSame) {
      emit('activity:react', { activityId: activity.id, projectId, userId: user?.id, emoji });
      return;
    }

    // Enforce one reaction per user per activity on UI:
    // remove current reaction(s) first, then add the chosen emoji.
    currentUserReactions.forEach((r: any) => {
      emit('activity:react', { activityId: activity.id, projectId, userId: user?.id, emoji: r.emoji });
    });
    emit('activity:react', { activityId: activity.id, projectId, userId: user?.id, emoji });
  };

  if (!isOpen || !localTask) return null;

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto items-start pt-[56px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex min-h-[90vh] w-full max-w-6xl flex-col overflow-visible rounded-[32px] border border-white/20 bg-[#f1f2f4] text-[#172b4d] shadow-[0_30px_70px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="absolute right-2 top-2 z-[60] flex items-center gap-0.5 sm:right-3 sm:top-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="rounded-lg border border-slate-200/90 bg-white/95 p-2 text-slate-500 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-slate-800"
            title="Đính kèm"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200/90 bg-white/95 p-2 text-slate-500 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-slate-800"
            title="Tùy chọn thẻ"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-300" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-all hover:bg-rose-100/90 hover:text-rose-600"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {(() => {
                const tbg = localTask.background;
                const has = Boolean(tbg && String(tbg).trim());
                const isImg = isTaskCoverImageUrl(tbg);
                if (!has) {
                  return (
                    <div className="relative w-full shrink-0 border-b border-slate-200/60">
                      <div className="overflow-hidden rounded-t-[32px]">
                        <div
                          className="h-40 w-full bg-slate-200/50"
                          style={{ background: 'linear-gradient(180deg, #c9d2de 0%, #e8ecf1 100%)' }}
                        />
                      </div>
                      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
                        <TaskCoverMenuButton
                          projectId={projectId}
                          taskId={localTask.id}
                          localTask={localTask}
                          onUpdate={(d) => handleUpdateTask(d)}
                          variant="onCover"
                        />
                      </div>
                    </div>
                  );
                }
                if (isImg) {
                  return (
                    <div className="relative w-full shrink-0 border-b border-slate-200/60">
                      <div className="relative min-h-[12rem] w-full overflow-hidden rounded-t-[32px] bg-slate-800 sm:min-h-[14rem]">
                        <div
                          className="h-full min-h-[12rem] w-full bg-center bg-no-repeat sm:min-h-[14rem]"
                          style={{
                            backgroundImage: `url(${String(tbg).trim()})`,
                            backgroundSize: 'contain',
                            backgroundPosition: 'center',
                          }}
                        />
                      </div>
                      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
                        <TaskCoverMenuButton
                          projectId={projectId}
                          taskId={localTask.id}
                          localTask={localTask}
                          onUpdate={(d) => handleUpdateTask(d)}
                          variant="onCover"
                        />
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="relative w-full shrink-0 border-b border-slate-200/60">
                    <div className="overflow-hidden rounded-t-[32px]">
                      <div
                        className="min-h-[12rem] w-full sm:min-h-[14rem]"
                        style={getCoverStripStyle(String(tbg))}
                      />
                    </div>
                    <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
                      <TaskCoverMenuButton
                        projectId={projectId}
                        taskId={localTask.id}
                        localTask={localTask}
                        onUpdate={(d) => handleUpdateTask(d)}
                        variant="onCover"
                      />
                    </div>
                  </div>
                );
              })()}

        <div className="shrink-0 border-b border-slate-200/50 bg-[#f1f2f4] px-5 pb-4 pt-4 sm:px-8 sm:py-4 lg:px-10">
          <div className="min-w-0 pr-16 sm:pr-20">
            <div className="mb-4 sm:mb-5">
              <div className="relative inline-block">
                <select
                  value={localTask.status}
                  onChange={(e) => handleUpdateTask({ status: e.target.value })}
                  className="cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600 shadow-sm outline-none transition-all hover:bg-slate-50"
                  style={{
                    backgroundImage:
                      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 8px center',
                    backgroundSize: '12px',
                    paddingRight: '2rem',
                  }}
                >
                  <option value="PENDING">Chờ xử lý</option>
                  <option value="IN_PROGRESS">Đang thực hiện</option>
                  <option value="DONE">Hoàn thành</option>
                  <option value="WAITING_FOR_DOCUMENT">Chờ tài liệu</option>
                  <option value="DELAYED">Tạm hoãn</option>
                  <option value="APPROVED">Đã duyệt</option>
                </select>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                <CheckSquare className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                {isEditingTitle ? (
                  <input
                    autoFocus
                    className="w-full rounded-xl border-2 border-indigo-500 bg-white px-4 py-1.5 text-2xl font-black leading-tight text-[#172b4d] shadow-xl shadow-indigo-500/10 outline-none"
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
                    className="cursor-text rounded-xl px-1 -ml-1 text-2xl font-black leading-snug text-[#172b4d] transition-colors hover:bg-slate-200/60"
                  >
                    {localTask.title}
                  </h2>
                )}
                <div className="mt-1.5 pl-0.5 text-xs font-bold text-slate-500">
                  trong danh sách{' '}
                  <span className="cursor-pointer text-slate-500 underline transition-colors hover:text-slate-700">
                    {localTask.status === 'PENDING'
                      ? 'Chờ xử lý'
                      : localTask.status === 'IN_PROGRESS'
                        ? 'Đang thực hiện'
                        : localTask.status === 'DONE'
                          ? 'Hoàn thành'
                          : localTask.status === 'WAITING_FOR_DOCUMENT'
                            ? 'Chờ tài liệu'
                            : localTask.status === 'DELAYED'
                              ? 'Tạm hoãn'
                              : localTask.status === 'APPROVED'
                                ? 'Đã duyệt'
                                : localTask.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-12">
            
            {/* Main Content (Left) */}
            <div className="space-y-10 border-slate-200 bg-white p-6 sm:space-y-10 sm:p-8 lg:col-span-9 lg:space-y-12 lg:rounded-bl-[32px] lg:p-10 lg:border-r max-lg:rounded-b-none">
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
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                    {localTask.labels?.map((label: any) => (
                      <div 
                        key={label.id} 
                        title={label.name} 
                        className="px-3 py-1 rounded-[4px] text-[12px] font-bold text-white shadow-sm flex items-center cursor-pointer hover:brightness-110 active:brightness-90 transition-all border border-black/10 min-w-[40px] justify-center" 
                        style={{ backgroundColor: label.color }}
                      >
                        {label.name || '\u00A0'}
                      </div>
                    ))}
                    <LabelPopover 
                      projectId={projectId}
                      taskId={localTask.id}
                      selectedLabels={localTask.labels || []}
                      onUpdate={(newLabelIds, updatedLabels) => {
                         handleUpdateTask({ labelIds: newLabelIds, labels: updatedLabels });
                      }}
                    />
                  </div>
                </div>

                {/* Due Date Overview (if exists) */}
                {(localTask.startDate || localTask.dueDate) && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center h-3">Hạn chót</h4>
                    <div className="flex items-center px-4 h-8 bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-xl text-[11px] font-black text-slate-700 cursor-pointer transition-all shadow-sm gap-3 group">
                      <Clock className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                      <span>{localTask.dueDate && format(new Date(localTask.dueDate), 'dd MMM, HH:mm')}</span>
                      {localTask.dueDate && differenceInSeconds(new Date(localTask.dueDate), new Date(nowMs)) < 0 ? (
                        <span className="bg-rose-500 text-white px-2 py-0.5 rounded-lg text-[9px] uppercase font-black shadow-lg shadow-rose-200">QUÁ HẠN</span>
                      ) : (
                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-lg text-[9px] uppercase font-black">MỚI</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Description Section */}
              <section className="space-y-5 pl-8">
                <div className="flex items-center space-x-4 font-black text-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                    <AlignLeft className="h-4 w-4 text-orange-500" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wide mb-2">Mô tả công việc</h3>
                </div>
                <div className="ml-12">
                  {isEditingDesc ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDescriptionExpandOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
                          title="Mở màn hình lớn để trình bày nội dung"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          Mở rộng
                        </button>
                      </div>
                      <div className="prose prose-sm max-w-none w-full border-2 border-indigo-500 rounded-2xl p-4 bg-white min-h-[200px] shadow-2xl shadow-indigo-500/5">
                        <EditorJs
                          key={descEditSessionKey}
                          onInitialize={handleDescEditorInit}
                          onChange={handleDescEditorChange}
                          defaultValue={descEditDefault}
                          placeholder="Thêm mô tả chi tiết hơn..."
                          tools={descEditorTools as any}
                        />
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={async () => {
                            let nextDesc = editedDesc;
                            if (descEditorRef.current) {
                              try {
                                const saved = await descEditorRef.current.save();
                                nextDesc = JSON.stringify(saved);
                              } catch (e) {
                                console.error(e);
                                toast.error('Không lưu được nội dung mô tả');
                                return;
                              }
                            }
                            handleUpdateTask({ description: nextDesc });
                            setIsEditingDesc(false);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-100 active:scale-95"
                        >
                          Lưu lại
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditedDesc(localTask.description || '');
                            setDescEditSessionKey((k) => k + 1);
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
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setEditedDesc(localTask.description || '');
                        setDescEditSessionKey((k) => k + 1);
                        setIsEditingDesc(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setEditedDesc(localTask.description || '');
                          setDescEditSessionKey((k) => k + 1);
                          setIsEditingDesc(true);
                        }
                      }}
                      className={`w-full bg-slate-50 hover:bg-slate-100/50 rounded-2xl p-5 text-sm text-slate-700 transition-all min-h-[80px] cursor-pointer border border-transparent hover:border-slate-200 leading-relaxed font-medium ${
                        !taskDescriptionHasContent(localTask.description) ? 'text-slate-400 italic' : ''
                      }`}
                    >
                      {taskDescriptionHasContent(localTask.description) ? (
                        <div
                          className="pointer-events-none [&_.ce-toolbar]:hidden [&_.ce-toolbox]:hidden"
                          aria-hidden
                        >
                          <EditorJsViewer
                            key={`${localTask.id}-view-${(localTask.description || '').length}-${(localTask.description || '').slice(-24)}`}
                            defaultValue={parseTaskDescriptionData(localTask.description)}
                            readOnly
                            tools={descEditorTools as any}
                          />
                        </div>
                      ) : (
                        <span>Thêm mô tả chi tiết hơn để mọi người cùng nắm bắt...</span>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Attachments Section */}
              {localTask.attachments && localTask.attachments.length > 0 && (
                <section className="space-y-6 pl-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 font-black text-slate-800">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                        <Paperclip className="h-4 w-4 text-slate-500" />
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wide mb-2">Các tập tin đính kèm</h3>
                    </div>
                    <AttachmentPopover projectId={projectId} taskId={localTask.id} onUpdate={onUpdate} />
                  </div>

                  <div className="ml-12 space-y-8">
                    {/* Links Category */}
                    {localTask.attachments.filter((a: any) => !a.fileSize).length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Liên kết</h4>
                        <div className="space-y-2">
                          {localTask.attachments.filter((a: any) => !a.fileSize).map((attachment: any) => (
                            <div key={attachment.id} className="group flex items-center p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all">
                              <div className="p-2 bg-slate-50 rounded-lg mr-4">
                                <LinkIcon className="w-4 h-4 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <a 
                                  href={attachment.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-sm font-bold text-blue-600 hover:underline truncate block"
                                >
                                  {attachment.fileName}
                                </a>
                                <p className="text-[10px] text-slate-500 mt-0.5">Đã thêm {format(new Date(attachment.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                              </div>
                              <Popover className="relative">
                                <Popover.Button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer transition-all">
                                  <MoreVertical className="w-4 h-4" />
                                </Popover.Button>
                                <Transition
                                  as={Fragment}
                                  enter="transition ease-out duration-150"
                                  enterFrom="opacity-0 translate-y-1"
                                  enterTo="opacity-100 translate-y-0"
                                  leave="transition ease-in duration-100"
                                  leaveFrom="opacity-100 translate-y-0"
                                  leaveTo="opacity-0 translate-y-1"
                                >
                                  <Popover.Panel className="absolute right-0 top-full z-[120] mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                                    <a
                                      href={attachment.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" /> Mở liên kết
                                    </a>
                                    <button
                                      onClick={() => handlePreviewAttachment(attachment)}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                    >
                                      <Eye className="h-3.5 w-3.5" /> Xem trước
                                    </button>
                                    <button
                                      onClick={handleCommentAttachment}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" /> Nhận xét
                                    </button>
                                    <button
                                      disabled={deletingAttachmentIds.has(attachment.id)}
                                      onClick={() => handleDeleteAttachment(attachment.id)}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:hover:bg-transparent"
                                    >
                                      <X className="h-3.5 w-3.5" /> {deletingAttachmentIds.has(attachment.id) ? 'Đang xóa...' : 'Loại bỏ'}
                                    </button>
                                  </Popover.Panel>
                                </Transition>
                              </Popover>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files Category */}
                    {localTask.attachments.filter((a: any) => a.fileSize).length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Tệp</h4>
                        <div className="space-y-3">
                          {localTask.attachments.filter((a: any) => a.fileSize).map((attachment: any) => {
                            const mime = attachment.mimetype || '';
                            const isImage = mime.includes('image');
                            const isVideo = mime.includes('video');
                            const isPdf = mime.includes('pdf');
                            const badge = getAttachmentTypeBadge(attachment);

                            const renderIcon = () => {
                              if (mime.includes('video')) return <FileVideo className="w-6 h-6 text-purple-500" />;
                              if (mime.includes('image')) return <FileImage className="w-6 h-6 text-emerald-500" />;
                              if (mime.includes('pdf')) return <FileText className="w-6 h-6 text-rose-500" />;
                              if (mime.includes('code') || mime.includes('javascript') || mime.includes('json')) return <FileCode className="w-6 h-6 text-blue-500" />;
                              return <FileIcon className="w-6 h-6 text-slate-500" />;
                            };

                            return (
                              <div key={attachment.id} className="group flex items-center p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewAttachment(attachment)}
                                  className="w-20 h-16 bg-slate-100 rounded-lg mr-4 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden"
                                >
                                  {isImage ? (
                                    <img
                                      src={attachment.fileUrl}
                                      alt={attachment.fileName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : isVideo ? (
                                    <video
                                      src={attachment.fileUrl}
                                      className="w-full h-full object-cover"
                                      muted
                                      preload="metadata"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center uppercase font-black text-slate-500 text-[10px]">
                                      {renderIcon()}
                                      <span className="mt-1">{badge}</span>
                                    </div>
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-bold text-slate-800 truncate pr-4">
                                    {attachment.fileName} 
                                    <span className="ml-2 font-medium text-slate-500">({formatAttachmentSize(attachment.fileSize)})</span>
                                  </h4>
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    Đã thêm {format(new Date(attachment.createdAt), 'dd/MM/yyyy HH:mm')}
                                  </p>
                                  {isPdf && (
                                    <p className="text-[11px] text-slate-600 mt-1 font-semibold">
                                      Có thể xem trước bằng cách mở trong tab mới
                                    </p>
                                  )}
                                </div>
                                <Popover className="relative">
                                  <Popover.Button className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg cursor-pointer transition-all">
                                    <MoreVertical className="w-4 h-4" />
                                  </Popover.Button>
                                  <Transition
                                    as={Fragment}
                                    enter="transition ease-out duration-150"
                                    enterFrom="opacity-0 translate-y-1"
                                    enterTo="opacity-100 translate-y-0"
                                    leave="transition ease-in duration-100"
                                    leaveFrom="opacity-100 translate-y-0"
                                    leaveTo="opacity-0 translate-y-1"
                                  >
                                    <Popover.Panel className="absolute right-0 top-full z-[120] mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                                      <a
                                        href={attachment.fileUrl}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                      >
                                        <Download className="h-3.5 w-3.5" /> Tải xuống
                                      </a>
                                      <button
                                        onClick={() => handlePreviewAttachment(attachment)}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                      >
                                        <Eye className="h-3.5 w-3.5" /> Xem trước
                                      </button>
                                      <button
                                        onClick={handleCommentAttachment}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                      >
                                        <MessageSquare className="h-3.5 w-3.5" /> Nhận xét
                                      </button>
                                      <button
                                        disabled={deletingAttachmentIds.has(attachment.id)}
                                        onClick={() => handleDeleteAttachment(attachment.id)}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:hover:bg-transparent"
                                      >
                                        <X className="h-3.5 w-3.5" /> {deletingAttachmentIds.has(attachment.id) ? 'Đang xóa...' : 'Loại bỏ'}
                                      </button>
                                    </Popover.Panel>
                                  </Transition>
                                </Popover>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Checklist Groups */}
              {localTask.checklists?.map((checklist: any) => {
                const progress = calculateProgress(checklist);
                return (
                  <section key={checklist.id} className="space-y-4 pl-8">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <CheckSquare className="h-4 w-4 text-emerald-500" />
                      </div>
                      {editingChecklistId === checklist.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            autoFocus
                            value={editingChecklistTitle}
                            onChange={(e) => setEditingChecklistTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveChecklistTitle(checklist.id);
                              if (e.key === 'Escape') cancelEditChecklistTitle();
                            }}
                            className="flex-1 px-3 py-1.5 border border-blue-300 bg-white rounded-lg text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button
                            onClick={() => saveChecklistTitle(checklist.id)}
                            className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Lưu
                          </button>
                          <button
                            onClick={cancelEditChecklistTitle}
                            className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-sm font-bold text-slate-700 flex-1">{checklist.title}</h3>
                          <button
                            onClick={() => startEditChecklistTitle(checklist.id, checklist.title)}
                            className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => requestDeleteChecklist(checklist.id, checklist.title)}
                            className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Xóa
                          </button>
                        </>
                      )}
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
                            disabled={checklist.id.startsWith('temp-')}
                            className={`w-full border-2 rounded-xl px-3 py-2 text-sm focus:outline-none font-medium text-slate-700 ${
                              checklist.id.startsWith('temp-') ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-blue-400'
                            }`}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAddCheckItem(checklist.id)}
                              disabled={checklist.id.startsWith('temp-')}
                              className={`font-bold py-1 px-4 text-xs rounded-md transition-colors ${
                                checklist.id.startsWith('temp-') ? 'bg-slate-300 text-slate-100 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              {checklist.id.startsWith('temp-') ? 'Đang lưu...' : 'Thêm'}
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
                      <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wide mb-2">Hoạt động thảo luận</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFullActivityLog((v) => !v)}
                      className={`text-[10px] px-3 py-1.5 rounded-xl font-black transition-all uppercase tracking-widest border ${
                        showFullActivityLog
                          ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-100'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-100'
                      }`}
                    >
                      {showFullActivityLog ? 'Thu gọn' : 'Hiện chi tiết'}
                    </button>
                  </div>
                  {!showFullActivityLog && hasMoreActivitiesThanCompact && (
                    <p className="text-[11px] text-slate-400 mb-4 -mt-4 pl-8">
                      Đang xem bản gọn: bình luận và thao tác thêm / xóa. Bật <span className="font-semibold text-slate-500">Hiện chi tiết</span> để xem
                      cập nhật thẻ, tick checklist, v.v.
                    </p>
                  )}

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
                               ref={commentTextareaRef}
                               placeholder="Chia sẻ ý kiến của bạn... (mention: @abcname)"
                               className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-700 hover:shadow-xl hover:shadow-slate-200/50 focus:shadow-xl focus:shadow-indigo-500/5 focus:border-indigo-500 transition-all outline-none min-h-[48px] font-medium resize-none"
                               value={newComment}
                               onChange={(e) => {
                                 setNewComment(e.target.value);
                                 updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
                               }}
                               onFocus={(e) => {
                                 e.target.style.minHeight = '120px';
                                 e.target.closest('.group')?.classList.add('is-focused');
                               }}
                               onClick={(e) => {
                                 updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length);
                               }}
                               onKeyUp={(e) => {
                                 updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length);
                               }}
                               onKeyDown={(e) => {
                                 // Send comment by Ctrl+Enter / Cmd+Enter.
                                 if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                   e.preventDefault();
                                   handleAddComment();
                                   return;
                                 }

                                 if (!isMentionOpen || filteredMentionCandidates.length === 0) return;
                                 if (e.key === 'ArrowDown') {
                                   e.preventDefault();
                                   setActiveMentionIndex((prev) => (prev + 1) % filteredMentionCandidates.length);
                                 } else if (e.key === 'ArrowUp') {
                                   e.preventDefault();
                                   setActiveMentionIndex((prev) => (prev - 1 + filteredMentionCandidates.length) % filteredMentionCandidates.length);
                                 } else if (e.key === 'Enter' || e.key === 'Tab') {
                                   e.preventDefault();
                                   applyMention(filteredMentionCandidates[activeMentionIndex].handle);
                                 } else if (e.key === 'Escape') {
                                   setIsMentionOpen(false);
                                 }
                               }}
                            />
                            {isMentionOpen && (
                              <div className="absolute z-30 mt-2 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl p-1">
                                {filteredMentionCandidates.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-slate-500">Không có thành viên phù hợp trong dự án</div>
                                ) : (
                                  filteredMentionCandidates.map((candidate: any, index: number) => (
                                    <button
                                      type="button"
                                      key={candidate.userId}
                                      onClick={() => applyMention(candidate.handle)}
                                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                        index === activeMentionIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      <div className="text-xs font-semibold">@{candidate.handle}</div>
                                      <div className="text-[11px] text-slate-500">
                                        {candidate.displayName}
                                        {candidate.employeeCode ? ` (${candidate.employeeCode})` : ''}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                        </div>
                        {newComment.includes('@') && (
                          <p className="text-[11px] text-slate-500 pl-1">
                            Mention theo dạng <span className="font-semibold text-slate-700">@abcname</span> (mã nhân sự hoặc tên không dấu liền nhau).
                          </p>
                        )}
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
                    {displayedActivities.length === 0 && allActivityCount === 0 && (
                      <p className="text-sm text-slate-400 pl-1">Chưa có hoạt động nào.</p>
                    )}
                    {displayedActivities.length === 0 && allActivityCount > 0 && !showFullActivityLog && (
                      <p className="text-sm text-slate-500 pl-1">
                        Chỉ còn nhật ký cập nhật (đổi thẻ, tiến độ, v.v.) — bấm <span className="font-semibold">Hiện chi tiết</span> ở trên
                        để xem toàn bộ.
                      </p>
                    )}
                     {displayedActivities.map((activity: any) => {
                        const d = new Date(activity.createdAt);
                        const dateStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate()} thg ${d.getMonth() + 1}, ${d.getFullYear()}`;
                        const isCompact = !showFullActivityLog;
                        
                        if (activity.type === 'SYSTEM') {
                           return (
                               <div key={activity.id} className="flex space-x-3 group animate-in fade-in duration-300 items-start">
                                   <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 overflow-hidden shadow-sm mt-0.5">
                                      <img src={`https://ui-avatars.com/api/?name=${activity.user.displayName}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                                   </div>
                                   <div className="flex-1 min-w-0 text-[14px]">
                                      <span className="font-bold text-slate-800 mr-1">{activity.user.displayName}</span>
                                      <span className={`text-slate-600 ${isCompact ? 'line-clamp-2' : ''}`}>{activity.content}</span>
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
                                    <div
                                      className={`p-3 bg-white border border-slate-200 rounded-tr-[12px] rounded-b-[12px] text-[14px] text-slate-800 leading-relaxed shadow-sm shadow-slate-100 mb-1 inline-block min-w-[50%] max-w-full ${
                                        !showFullActivityLog ? 'line-clamp-3' : ''
                                      }`}
                                    >
                                       {activity.content}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pl-1 mt-1">
                                       {(() => {
                                         const reactions = activity.reactions || [];
                                         const currentUserReactions = reactions.filter((r: any) => r.userId === user?.id);
                                         const myEmoji = currentUserReactions[0]?.emoji;
                                         const reactionReady = isPersistedActivityId(activity.id);
                                         if (!reactionReady) {
                                           return (
                                             <span
                                               className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[#65676B] opacity-40 cursor-not-allowed"
                                               title="Đang gửi bình luận…"
                                             >
                                               <AddReactionGlyph className="h-[18px] w-[18px]" />
                                             </span>
                                           );
                                         }
                                         return (
                                           <Popover className="relative">
                                             {({ close }) => (
                                               <>
                                                 <Popover.Button
                                                   className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[#65676B] hover:bg-[#F0F2F5] active:bg-[#E4E6EB] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                                                   title={myEmoji ? 'Đổi hoặc bỏ cảm xúc' : 'Thêm cảm xúc'}
                                                 >
                                                   {myEmoji ? (
                                                     <span className="text-[17px] leading-none select-none">{myEmoji}</span>
                                                   ) : (
                                                     <AddReactionGlyph className="h-[18px] w-[18px]" />
                                                   )}
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
                                                   <Popover.Panel className="absolute z-[60] bottom-full mb-2 left-0 bg-white shadow-xl border border-slate-200/80 rounded-full py-1 px-1.5 flex items-center gap-0.5">
                                                     {EMOJI_OPTIONS.map((emoji) => (
                                                       <button
                                                         key={emoji}
                                                         type="button"
                                                         onClick={() => {
                                                           handleReactionClick(activity, emoji);
                                                           close();
                                                         }}
                                                         className={`w-9 h-9 flex items-center justify-center hover:bg-slate-100 rounded-full text-[20px] transition-colors ${
                                                           myEmoji === emoji ? 'bg-blue-50 ring-2 ring-blue-200/80' : ''
                                                         }`}
                                                       >
                                                         {emoji}
                                                       </button>
                                                     ))}
                                                   </Popover.Panel>
                                                 </Transition>
                                               </>
                                             )}
                                           </Popover>
                                         );
                                       })()}

                                       {(() => {
                                         const reactions = activity.reactions || [];
                                         const uniqueEmojis = Array.from(new Set(reactions.map((r: any) => r.emoji)));
                                         const onlyCurrentUserReactions =
                                           reactions.length > 0 && reactions.every((r: any) => r.userId === user?.id);
                                         if (
                                           reactions.length === 0 ||
                                           (onlyCurrentUserReactions && uniqueEmojis.length === 1)
                                         ) {
                                           return null;
                                         }
                                         return (
                                           <div className="flex items-center gap-1.5 ml-0.5">
                                             {uniqueEmojis.map((emoji: any) => {
                                               const hasReacted = reactions.some(
                                                 (r: any) => r.emoji === emoji && r.userId === user?.id
                                               );
                                               const usersWhoReacted = reactions
                                                 .filter((r: any) => r.emoji === emoji)
                                                 .map((r: any) => r.user?.displayName)
                                                 .join(', ');
                                               const count = reactions.filter((r: any) => r.emoji === emoji).length;
                                               return (
                                                 <button
                                                   key={emoji as string}
                                                   type="button"
                                                   title={usersWhoReacted}
                                                   onClick={() => handleReactionClick(activity, emoji as string)}
                                                   className={`flex items-center gap-0.5 pl-1.5 pr-2 py-0.5 rounded-full text-[12px] font-semibold transition-colors border ${
                                                     hasReacted
                                                       ? 'bg-blue-50/90 border-blue-200 text-blue-800'
                                                       : 'bg-[#F0F2F5] border-transparent text-slate-700 hover:bg-[#E4E6EB]'
                                                   }`}
                                                 >
                                                   <span className="leading-none">{emoji as string}</span>
                                                   {count > 1 && (
                                                     <span className="text-[11px] text-slate-600 tabular-nums">{count}</span>
                                                   )}
                                                 </button>
                                               );
                                             })}
                                           </div>
                                         );
                                       })()}

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
            <div className="lg:col-span-3 p-8 space-y-8 bg-slate-50/20 rounded-tr-[48px] max-lg:rounded-b-[32px] lg:rounded-br-[32px]">
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

                {/* Attachment Section Handlers */}
                <AttachmentPopover projectId={projectId} taskId={localTask.id} onUpdate={onUpdate} />
              </div>

              {/* Actions Section */}
              <div className="space-y-4 pt-8 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Phím tắt thao tác</h4>
                <button className="w-full px-4 py-3 bg-white border border-slate-100 hover:bg-slate-50 text-slate-600 rounded-2xl text-xs font-black flex items-center transition-all shadow-sm">
                   Di chuyển thẻ
                </button>
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(true)}
                  className="w-full px-4 py-3 bg-white border border-slate-100 hover:bg-slate-50 text-slate-600 rounded-2xl text-xs font-black flex items-center transition-all shadow-sm"
                >
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

        {previewAttachment && typeof window !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[999] bg-black/65 backdrop-blur-[2px] p-6">
            <div className="relative w-full h-full max-w-6xl mx-auto">
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-black text-white flex items-center justify-center transition-colors shadow-lg"
                title="Đóng xem trước"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-full h-full rounded-lg border border-white/25 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.55)] overflow-hidden">
                <div className="h-[calc(100%-48px)] bg-slate-100">
                  {getAttachmentPreviewType(previewAttachment) === 'image' ? (
                    <img
                      src={previewAttachment.fileUrl}
                      alt={previewAttachment.fileName}
                      className="w-full h-full object-contain"
                    />
                  ) : getAttachmentPreviewType(previewAttachment) === 'video' ? (
                    <video
                      src={previewAttachment.fileUrl}
                      className="w-full h-full bg-black"
                      controls
                      autoPlay
                    />
                  ) : isPreviewableAttachment(previewAttachment) ? (
                    <iframe
                      src={getEmbedPreviewUrl(previewAttachment)}
                      title={previewAttachment.fileName}
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center p-8 bg-white">
                      <div className="max-w-md text-center">
                        <p className="text-base font-bold text-slate-700">Không thể xem trước loại tệp này</p>
                        <p className="text-sm text-slate-500 mt-2">
                          Bạn có thể mở ở tab mới hoặc tải xuống để xem đầy đủ nội dung.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-12 bg-slate-900/90 text-white flex items-center justify-between px-4 text-xs">
                  <span className="truncate pr-4 font-medium text-slate-100">
                    {previewAttachment.fileName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={previewAttachment.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                    >
                      Mở tab mới
                    </a>
                    <a
                      href={previewAttachment.fileUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                    >
                      Tải xuống
                    </a>
                    <button
                      type="button"
                      disabled={deletingAttachmentIds.has(previewAttachment.id)}
                      onClick={() => handleDeleteAttachment(previewAttachment.id)}
                      className="px-2.5 py-1 rounded bg-rose-600/90 hover:bg-rose-500 transition-colors disabled:opacity-50"
                    >
                      {deletingAttachmentIds.has(previewAttachment.id) ? 'Đang xóa...' : 'Xóa'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        <ConfirmModal
          isOpen={!!checklistToDelete}
          title="Xóa danh sách checklist?"
          description={`Bạn sắp xóa "${checklistToDelete?.title || 'danh sách'}". Hành động này không thể hoàn tác.`}
          onConfirm={confirmDeleteChecklist}
          onCancel={() => setChecklistToDelete(null)}
        />
      </div>
    <DescriptionEditorExpandModal
      isOpen={descriptionExpandOpen}
      onClose={() => setDescriptionExpandOpen(false)}
      value={editedDesc}
      title="Soạn mô tả công việc"
      zIndexClass="z-[200]"
      onApply={(json) => {
        setEditedDesc(json);
        setDescEditSessionKey((k) => k + 1);
        setDescriptionExpandOpen(false);
      }}
    />

    {isCopyModalOpen &&
      typeof window !== 'undefined' &&
      createPortal(
        <div
          className="fixed inset-0 z-[130] flex items-start justify-center bg-slate-900/55 backdrop-blur-[2px] p-4 pt-[56px]"
          onClick={() => setIsCopyModalOpen(false)}
          role="presentation"
        >
          <div className="mt-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CopyTaskCardForm
              mode="modal"
              projectId={projectId}
              projectName={projectName}
              sourceTask={localTask}
              sourceTaskId={localTask.id}
              initialTitle={localTask.title || ''}
              initialStatus={localTask.status}
              boardTasks={boardTasks}
              onClose={() => setIsCopyModalOpen(false)}
              onOptimisticTaskCopy={onOptimisticTaskCopy}
              onCopyTaskConfirm={onCopyTaskConfirm}
              onCopyTaskRollback={onCopyTaskRollback}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
