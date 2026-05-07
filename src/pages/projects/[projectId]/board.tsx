import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MainLayout from '@/components/Layout/MainLayout';
import ProjectBoard, { type ServerBoardList } from '@/components/Project/ProjectBoard';
import { type BoardTemplateOption, normalizeBoardTemplateOption } from '@/lib/boardTemplateOption';
import { BoardTemplatePreview } from '@/components/Project/BoardTemplatePreview';
import TaskDetailModal from '@/components/Project/TaskDetailModal';
import CreateTaskModal from '@/components/Modal/CreateTaskModal';
import BoardBackgroundPopover from '@/components/Project/BoardBackgroundPopover';
import axiosInstance from '@/lib/axios';
import { 
  Settings, 
  Users, 
  ChevronRight,
  Image as ImageIcon,
  Search,
  Wand2,
  LayoutTemplate,
  Pencil
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/Layout/PageHeader';
import { useSocket, getSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';
import ManageMemberModal from '@/components/Modal/ManageMemberModal';
import ConfirmModal from '@/components/Modal/ConfirmModal';
import { EditBoardTemplateModal } from '@/components/Modal/EditBoardTemplateModal';
import { useAuthStore } from '@/store/authStore';
import { shouldShowTaskOnBoard } from '@/lib/boardTaskVisibility';
import { getBoardBackgroundStyle, type TaskCoverMode } from '@/lib/boardBackgroundStyle';
import { useBoardBranding } from '@/contexts/boardBrandingContext';
import { buildAppFaviconDataUrl } from '@/lib/appFavicon';
import { APP_FAVICON_HREF } from '@/components/Brand/AppLogo';

/** Mọi rel mà `_document` / trình duyệt có thể dùng — phải cập nhật hết kẻo tab vẫn giữ favicon tĩnh. */
const FAVICON_LINK_RELS = ['icon', 'shortcut icon', 'alternate icon'] as const;

function taskMatchesBoardColumn(
  t: any,
  boardListId: string | null | undefined,
  mapsToStatus: string
): boolean {
  if (boardListId && t.boardListId === boardListId) return true;
  if (!t.boardListId && t.status === mapsToStatus) return true;
  return false;
}

function insertCopiedTaskInColumn(
  prev: any[],
  boardListId: string | null | undefined,
  mapsToStatus: string,
  position1Based: number,
  task: any
): any[] {
  const insertAt = Math.max(0, position1Based - 1);
  const out: any[] = [];
  let colDone = false;
  for (const t of prev) {
    if (!taskMatchesBoardColumn(t, boardListId, mapsToStatus)) {
      out.push(t);
      continue;
    }
    if (!colDone) {
      const inCol = prev.filter((x) => taskMatchesBoardColumn(x, boardListId, mapsToStatus));
      const col = [...inCol];
      col.splice(Math.min(insertAt, col.length), 0, task);
      out.push(...col);
      colDone = true;
      continue;
    }
  }
  if (!colDone) {
    out.push(task);
  }
  return out;
}

function buildOptimisticCopyTask(
  source: any,
  tempId: string,
  title: string,
  status: string,
  boardListId?: string | null
): any {
  const checklists = Array.isArray(source?.checklists)
    ? source.checklists.map((cl: any) => ({
        ...cl,
        id: `${tempId}-cl-${cl.id}`,
        items: (cl.items || []).map((it: any) => ({
          ...it,
          id: `${tempId}-it-${it.id}`,
          isDone: false,
        })),
      }))
    : [];
  return {
    ...source,
    id: tempId,
    title,
    status,
    boardListId: boardListId ?? source?.boardListId ?? null,
    activities: [],
    attachments: [],
    checklists,
    subTasks: [],
  };
}

export default function BoardPage() {
  const router = useRouter();
  const { projectId: projectIdParam } = router.query;
  const projectId = useMemo(
    () => (Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam) as string | undefined,
    [projectIdParam]
  );
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [boardLists, setBoardLists] = useState<ServerBoardList[]>([]);
  const [preselectedStatus, setPreselectedStatus] = useState<string>('PENDING');
  const [preselectedBoardListId, setPreselectedBoardListId] = useState<string | null>(null);
  /** Giao diện bảng riêng (nền + màu cột) — GET/PATCH `/me/board-view` */
  const [myBoardView, setMyBoardView] = useState<{ background?: string | null; columnColors?: Record<string, string> | null } | null>(null);
  const lastBgUpdateRef = useRef<number>(0);
  const lastTaskUpdatesRef = useRef<Record<string, number>>({});
  const [isBackgroundPopoverOpen, setIsBackgroundPopoverOpen] = useState<boolean | 'bg'>(false);
  const [boardSearch, setBoardSearch] = useState('');
  const [boardTemplateOptions, setBoardTemplateOptions] = useState<BoardTemplateOption[]>([]);
  const [applyTemplateModalOpen, setApplyTemplateModalOpen] = useState(false);
  const [applyHeaderTemplateId, setApplyHeaderTemplateId] = useState('');
  const [applyHeaderSubmitting, setApplyHeaderSubmitting] = useState(false);
  const [applyHeaderConfirmOpen, setApplyHeaderConfirmOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);

  const headerSelectedTemplateLists = useMemo(() => {
    if (!applyHeaderTemplateId) return [];
    return boardTemplateOptions.find((o) => o.id === applyHeaderTemplateId)?.lists ?? [];
  }, [boardTemplateOptions, applyHeaderTemplateId]);

  const headerSelectedTemplateOption = useMemo(
    () => boardTemplateOptions.find((o) => o.id === applyHeaderTemplateId),
    [boardTemplateOptions, applyHeaderTemplateId]
  );

  const templateBeingEdited = useMemo(
    () =>
      editTemplateId ? boardTemplateOptions.find((t) => t.id === editTemplateId) ?? null : null,
    [editTemplateId, boardTemplateOptions]
  );

  const { user } = useAuthStore() as { user: any };
  const { setBoardBrandingBackground } = useBoardBranding();

  const myProjectMember = useMemo(
    () =>
      members.find(
        (m: any) => m.userId === user?.id || m.user?.id === user?.id
      ),
    [members, user?.id]
  );

  const boardListsForCopy = useMemo(
    () => boardLists.map((l) => ({ id: l.id, name: l.name, mapsToStatus: l.mapsToStatus })),
    [boardLists]
  );

  /** Nền hiển thị: ưu tiên nền cá nhân, không có thì nền mặc định dự án */
  const effectiveBoardBackground = useMemo(() => {
    const personal = myBoardView?.background;
    if (typeof personal === 'string' && personal.trim()) return personal;
    const team = project?.background;
    if (typeof team === 'string' && team.trim()) return team;
    return null;
  }, [myBoardView?.background, project?.background]);

  /** Cột gộp màu chung + override cá nhân (chỉ ảnh hưởng màn hình của user) */
  const mergedBoardLists = useMemo(() => {
    const ov = myBoardView?.columnColors;
    if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return boardLists;
    const map = ov as Record<string, string>;
    return boardLists.map((l) => ({
      ...l,
      colorClass: map[l.id] ?? l.colorClass,
    }));
  }, [boardLists, myBoardView]);

  const boardViewApiPath = projectId ? `/projects/${projectId}/me/board-view` : '';

  const savePersonalColumnColor = useCallback(
    async (listId: string, colorClass: string) => {
      if (!projectId) return;
      const base =
        myBoardView?.columnColors && typeof myBoardView.columnColors === 'object' && !Array.isArray(myBoardView.columnColors)
          ? { ...(myBoardView.columnColors as Record<string, string>) }
          : {};
      const columnColors = { ...base, [listId]: colorClass };
      const { data } = await axiosInstance.patch(`/projects/${projectId}/me/board-view`, { columnColors });
      setMyBoardView(data.boardView ?? null);
    },
    [projectId, myBoardView]
  );

  const isSystemAdmin = user?.role === 'ADMIN';
  const canManageMembers =
    isSystemAdmin ||
    project?.myProjectRole === 'PROJECT_OWNER' ||
    myProjectMember?.projectRole === 'PROJECT_OWNER';

  /** Quản lý bảng theo projectRole: PROJECT_OWNER hoặc TEAM_LEAD trong dự án (+ admin hệ thống) */
  const canManageBoard =
    isSystemAdmin ||
    project?.myProjectRole === 'PROJECT_OWNER' ||
    myProjectMember?.projectRole === 'PROJECT_OWNER' ||
    myProjectMember?.projectRole === 'TEAM_LEAD';

  const refreshBoardTemplates = useCallback(() => {
    if (!projectId || !canManageBoard) {
      setBoardTemplateOptions([]);
      return;
    }
    void axiosInstance
      .get('/projects/board-templates')
      .then((res) => {
        const raw = res.data || [];
        setBoardTemplateOptions((raw as any[]).map((t) => normalizeBoardTemplateOption(t)));
      })
      .catch(() => setBoardTemplateOptions([]));
  }, [projectId, canManageBoard]);

  useEffect(() => {
    refreshBoardTemplates();
  }, [refreshBoardTemplates]);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [projectRes, tasksRes, membersRes, listsRes, viewRes] = await Promise.all([
        axiosInstance.get(`/projects/${projectId}`),
        axiosInstance.get(`/projects/${projectId}/tasks`),
        axiosInstance.get(`/projects/${projectId}/members`),
        axiosInstance.get(`/projects/${projectId}/board-lists`),
        axiosInstance.get(`/projects/${projectId}/me/board-view`).catch(() => ({ data: { boardView: null } })),
      ]);
      const p = projectRes.data;
      setProject(p);
      setTasks(tasksRes.data);
      setMembers(membersRes.data);
      setBoardLists(listsRes.data || []);
      setMyBoardView(viewRes.data?.boardView ?? null);
    } catch (error) {
      console.error('Error fetching board data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const refreshBoardListsOnly = useCallback(async () => {
    if (!projectId) return;
    try {
      const listsRes = await axiosInstance.get(`/projects/${projectId}/board-lists`);
      setBoardLists(listsRes.data || []);
    } catch (e) {
      console.error('Error fetching board lists:', e);
    }
  }, [projectId]);

  const refreshTasksOnly = useCallback(async () => {
    if (!projectId) return;
    try {
      const tasksRes = await axiosInstance.get(`/projects/${projectId}/tasks`);
      setTasks(tasksRes.data);
    } catch (e) {
      console.error('Error fetching tasks:', e);
    }
  }, [projectId]);

  useEffect(() => {
    if (!applyTemplateModalOpen) return;
    if (boardTemplateOptions.length === 0) {
      setApplyHeaderTemplateId('');
      return;
    }
    setApplyHeaderTemplateId((prev) =>
      prev && boardTemplateOptions.some((o) => o.id === prev) ? prev : boardTemplateOptions[0].id
    );
  }, [applyTemplateModalOpen, boardTemplateOptions]);

  const openHeaderApplyConfirm = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!projectId || !applyHeaderTemplateId) return;
      if (boardTemplateOptions.length === 0) {
        toast.error('Chưa có template để áp dụng');
        return;
      }
      setApplyHeaderConfirmOpen(true);
    },
    [projectId, applyHeaderTemplateId, boardTemplateOptions.length]
  );

  const executeHeaderApplyTemplate = useCallback(async () => {
    if (!projectId || !applyHeaderTemplateId) return;
    setApplyHeaderSubmitting(true);
    try {
      const { data } = await axiosInstance.post<{ boardLists?: ServerBoardList[] }>(
        `/projects/${projectId}/board-templates/apply`,
        { templateId: applyHeaderTemplateId }
      );
      toast.success('Đã áp dụng template');
      setApplyHeaderConfirmOpen(false);
      setApplyTemplateModalOpen(false);
      if (data?.boardLists?.length) {
        setBoardLists(data.boardLists);
      } else {
        await refreshBoardListsOnly();
      }
      await refreshTasksOnly();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; message?: string } } };
      toast.error(
        ax.response?.data?.error || ax.response?.data?.message || 'Không áp dụng được template'
      );
    } finally {
      setApplyHeaderSubmitting(false);
    }
  }, [projectId, applyHeaderTemplateId, refreshBoardListsOnly, refreshTasksOnly]);

  const { socket } = useSocket(projectId);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setBoardBrandingBackground(effectiveBoardBackground);
    return () => setBoardBrandingBackground(null);
  }, [effectiveBoardBackground, setBoardBrandingBackground]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let cancelled = false;

    const applyFaviconHref = (href: string) => {
      const mime = href.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml';
      for (const rel of FAVICON_LINK_RELS) {
        const nodes = document.querySelectorAll<HTMLLinkElement>(`link[rel='${rel}']`);
        if (nodes.length === 0) {
          const el = document.createElement('link');
          el.rel = rel;
          el.type = mime;
          el.href = href;
          document.head.appendChild(el);
          continue;
        }
        nodes.forEach((el) => {
          el.type = mime;
          el.href = href;
        });
      }
    };

    (async () => {
      try {
        const href = await buildAppFaviconDataUrl(effectiveBoardBackground);
        if (!cancelled) applyFaviconHref(href);
      } catch {
        if (!cancelled) applyFaviconHref(APP_FAVICON_HREF);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveBoardBackground]);

  useEffect(() => {
    return () => {
      if (typeof document === 'undefined') return;
      const def = APP_FAVICON_HREF;
      for (const rel of FAVICON_LINK_RELS) {
        document.querySelectorAll<HTMLLinkElement>(`link[rel='${rel}']`).forEach((link) => {
          link.type = 'image/svg+xml';
          link.href = def;
        });
      }
    };
  }, []);

  useEffect(() => {
    if (tasks.length > 0 && router.query.taskId) {
      const taskInUrl = tasks.find((t) => t.id === router.query.taskId);
      if (taskInUrl && (!selectedTask || selectedTask.id !== taskInUrl.id)) {
        setSelectedTask(taskInUrl);
        // Remove taskId from url so modal can be closed normally without reopening
        router.replace(`/projects/${projectId}/board`, undefined, { shallow: true });
      }
    }
  }, [tasks, router.query.taskId, projectId, router, selectedTask]);

  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return;
    const s = getSocket();
    if (!s) return;

    const hMoved = ({ taskId, status, task: updatedTask }: any) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                ...(updatedTask?.boardListId !== undefined ? { boardListId: updatedTask.boardListId } : {}),
                ...updatedTask,
              }
            : t
        )
      );
    };

    const hUpdated = (updatedTask: any) => {
      if (updatedTask.senderId === s.id) return;

      const lastUpdate = lastTaskUpdatesRef.current[updatedTask.id] || 0;
      if (updatedTask.updatedAt && updatedTask.updatedAt <= lastUpdate) return;

      if (updatedTask.updatedAt) {
        lastTaskUpdatesRef.current[updatedTask.id] = updatedTask.updatedAt;
      }

      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === updatedTask.id);
        const show = shouldShowTaskOnBoard(updatedTask, user?.id, myProjectMember);
        if (idx >= 0) {
          if (!show) {
            return prev.filter((t) => t.id !== updatedTask.id);
          }
          return prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
        }
        if (show) {
          return [updatedTask, ...prev];
        }
        return prev;
      });
      setSelectedTask((prev: any) => {
        if (prev?.id !== updatedTask.id) return prev;
        if (!shouldShowTaskOnBoard(updatedTask, user?.id, myProjectMember)) {
          return null;
        }
        return { ...prev, ...updatedTask };
      });
    };

    const hCreated = (newTask: any) => {
      setTasks((prev) => {
        if (prev.find((t) => t.id === newTask.id)) return prev;
        if (!shouldShowTaskOnBoard(newTask, user?.id, myProjectMember)) return prev;
        return [newTask, ...prev];
      });
    };

    const hDeleted = ({ taskId }: any) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTask((prev: any) => (prev?.id === taskId ? null : prev));
    };

    const hReordered = ({ taskIds, status, boardListId, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) => {
        const otherTasks = prev.filter((t) => !taskIds.includes(t.id));
        const updatedTasksInStatus = taskIds
          .map((id: string) => {
            const task = prev.find((t) => t.id === id);
            return task
              ? {
                  ...task,
                  status,
                  ...(boardListId ? { boardListId } : {}),
                }
              : null;
          })
          .filter(Boolean);
        return [...otherTasks, ...updatedTasksInStatus] as any[];
      });
    };

    const hBackground = ({ projectId: changedId, background, updatedAt, senderId, userId: authorUserId }: any) => {
      if (projectId && changedId === projectId) {
        if (authorUserId && user?.id && authorUserId === user.id) return;
        if (senderId === s.id) return;
        if (updatedAt && updatedAt <= lastBgUpdateRef.current) return;
        if (updatedAt) lastBgUpdateRef.current = updatedAt;
        /* Chỉ cập nhật nền mặc định dự án; hiển thị vẫn ưu tiên nền trong myBoardView */
        setProject((p: any) => (p ? { ...p, background } : p));
      }
    };

    const hActivityAdded = ({ taskId, activity }: any) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (t.activities?.some((a: any) => a.id === activity.id)) return t;
          return { ...t, activities: [activity, ...(t.activities || [])] };
        })
      );
    };

    const hActivityEdited = ({ activity }: any) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (!t.activities?.some((a: any) => a.id === activity.id)) return t;
          return {
            ...t,
            activities: t.activities.map((a: any) => (a.id === activity.id ? activity : a))
          };
        })
      );
    };

    const hActivityDeleted = ({ activityId }: any) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (!t.activities?.some((a: any) => a.id === activityId)) return t;
          return { ...t, activities: t.activities.filter((a: any) => a.id !== activityId) };
        })
      );
    };

    const hClCreated = ({ taskId, checklist, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (t.checklists?.some((c: any) => c.id === checklist.id)) return t;
          return { ...t, checklists: [...(t.checklists || []), checklist] };
        })
      );
    };

    const hClDeleted = ({ taskId, checklistId, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (!t.checklists?.some((c: any) => c.id === checklistId)) return t;
          return { ...t, checklists: t.checklists.filter((c: any) => c.id !== checklistId) };
        })
      );
    };

    const hItemAdded = ({ taskId, checklistId, checklistItem, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            checklists: t.checklists?.map((c: any) => {
              if (c.id !== checklistId) return c;
              if (c.items?.some((i: any) => i.id === checklistItem.id)) return c;
              return { ...c, items: [...(c.items || []), checklistItem] };
            })
          };
        })
      );
    };

    const hItemUpdated = ({ taskId, checklistId, checklistItem, senderId }: any) => {
      if (senderId === s.id) return;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            checklists: t.checklists?.map((c: any) => {
              if (c.id !== checklistId) return c;
              return {
                ...c,
                items: c.items?.map((i: any) => (i.id === checklistItem.id ? checklistItem : i))
              };
            })
          };
        })
      );
    };

    const hItemDeleted = ({ taskId, checklistId, itemId }: any) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            checklists: t.checklists?.map((c: any) => {
              if (c.id !== checklistId) return c;
              return { ...c, items: c.items?.filter((i: any) => i.id !== itemId) };
            })
          };
        })
      );
    };

    s.on('task:moved', hMoved);
    s.on('task:updated', hUpdated);
    s.on('task:created', hCreated);
    s.on('task:deleted', hDeleted);
    s.on('tasks:reordered', hReordered);
    s.on('project:backgroundChanged', hBackground);
    s.on('activity:added', hActivityAdded);
    s.on('activity:edited', hActivityEdited);
    s.on('activity:deleted', hActivityDeleted);
    s.on('checklist:created', hClCreated);
    s.on('checklist:deleted', hClDeleted);
    s.on('checklistItem:added', hItemAdded);
    s.on('checklistItem:updated', hItemUpdated);
    s.on('checklistItem:deleted', hItemDeleted);

    return () => {
      s.off('task:moved', hMoved);
      s.off('task:updated', hUpdated);
      s.off('task:created', hCreated);
      s.off('task:deleted', hDeleted);
      s.off('tasks:reordered', hReordered);
      s.off('project:backgroundChanged', hBackground);
      s.off('activity:added', hActivityAdded);
      s.off('activity:edited', hActivityEdited);
      s.off('activity:deleted', hActivityDeleted);
      s.off('checklist:created', hClCreated);
      s.off('checklist:deleted', hClDeleted);
      s.off('checklistItem:added', hItemAdded);
      s.off('checklistItem:updated', hItemUpdated);
      s.off('checklistItem:deleted', hItemDeleted);
    };
  }, [projectId, user?.id, myProjectMember]);

  const handleOptimisticUpdate = useCallback((taskId: string, newStatus: string, boardListId?: string | null) => {
    setTasks((prev) =>
      prev.map((t: any) =>
        t.id === taskId ? { ...t, status: newStatus, boardListId: boardListId ?? t.boardListId } : t
      )
    );
  }, []);

  const handleOptimisticTaskPatch = useCallback((taskId: string, patch: Record<string, unknown>) => {
    const now = Date.now();
    lastTaskUpdatesRef.current[taskId] = now;
    if (patch.archived === true) {
      setTasks((prev) => prev.filter((t: any) => t.id !== taskId));
      setSelectedTask((prev: any) => (prev?.id === taskId ? null : prev));
      return;
    }
    const { labelIds: _l, ...rest } = patch;
    setTasks((prev) => prev.map((t: any) => (t.id === taskId ? { ...t, ...rest } : t)));
  }, []);

  const handleUpdateTaskAppearance = useCallback((taskId: string, data: { background?: string; textColor?: string; coverMode?: TaskCoverMode | null }) => {
    // Record timestamp to ignore stale socket echoes
    const now = Date.now();
    lastTaskUpdatesRef.current[taskId] = now;

    const normalized =
      data.coverMode === 'FULL' ? { ...data, coverMode: 'SPLIT' as const } : data;

    // Optimistic UI update at the source of truth
    setTasks((prev) => prev.map((t: any) => (t.id === taskId ? { ...t, ...normalized } : t)));

    // Ảnh tạm từ file (blob:) — chỉ cập nhật UI, gửi server sau khi upload xong
    if (data.background && String(data.background).startsWith('blob:')) {
      return;
    }

    if (socket) {
      socket.emit('task:update', {
        taskId,
        projectId,
        userId: user?.id,
        updates: normalized,
        updatedAt: now,
        senderId: socket.id
      });
    }
  }, [projectId, socket, user?.id]);

  const handleLocalTaskUpdate = useCallback((updatedTask: any) => {
    // Record this as the latest update for this task
    lastTaskUpdatesRef.current[updatedTask.id] = Date.now();

    if (updatedTask.archived === true) {
      setTasks((prev) => prev.filter((t: any) => t.id !== updatedTask.id));
      setSelectedTask((prev: any) => (prev?.id === updatedTask.id ? null : prev));
      return;
    }

    setTasks((prev) => prev.map((t: any) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)));
  }, []);

  const handleOptimisticReorder = useCallback((taskIds: string[], status: string, boardListId: string) => {
    setTasks((prev) => {
      const otherTasks = prev.filter((t) => !taskIds.includes(t.id));
      const updatedTasksInStatus = taskIds
        .map((id: string) => {
          const task = prev.find((t) => t.id === id);
          return task ? { ...task, status, boardListId } : null;
        })
        .filter(Boolean);

      return [...otherTasks, ...updatedTasksInStatus] as any[];
    });
  }, []);

  const handleOptimisticTaskCopy = useCallback(
    (args: {
      tempId: string;
      title: string;
      status: string;
      boardListId: string | null;
      position: number;
      sourceTask: any;
    }) => {
      const { tempId, title, status, position, sourceTask, boardListId } = args;
      const optimistic = buildOptimisticCopyTask(sourceTask, tempId, title, status, boardListId);
      lastTaskUpdatesRef.current[tempId] = Date.now();
      setTasks((prev) => insertCopiedTaskInColumn(prev, boardListId, status, position, optimistic));
    },
    []
  );

  const handleCopyTaskConfirm = useCallback((tempId: string, serverTask: any) => {
    const now = Date.now();
    lastTaskUpdatesRef.current[serverTask.id] = now;
    setTasks((prev) => {
      const mapped = prev.map((t) => (t.id === tempId ? serverTask : t));
      const seen = new Set<string>();
      return mapped.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
    });
    setSelectedTask((prev: any) => (prev?.id === tempId ? serverTask : prev));
  }, []);

  const handleCopyTaskRollback = useCallback((tempId: string, message?: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== tempId));
    setSelectedTask((prev: any) => (prev?.id === tempId ? null : prev));
    if (message) {
      toast.error(message);
    }
  }, []);

  if (loading && !project) {
    return (
      <MainLayout>
        <div className="h-full flex items-center justify-center">
           <div className="flex flex-col items-center space-y-4">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Đang khởi tạo bảng...</span>
           </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout noPadding noScroll fullWidth>
      <Head>
        <title>{project ? `${project.name} - Bảng công việc | PMS` : 'Bảng công việc | PMS'}</title>
      </Head>
      <div
        className="relative z-[1] flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden board-page-active"
        style={effectiveBoardBackground ? getBoardBackgroundStyle(effectiveBoardBackground) : undefined}
      >
        <div className="shrink-0 px-10 pt-6">
          <PageHeader 
            title={project?.name ? `${project.name} / Bảng công việc` : 'Bảng công việc'}
            breadcrumbs={
            <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest gap-2">
              <Link href="/projects" className="hover:text-emerald-500 transition-colors">Dự án</Link>
              <ChevronRight className="h-3 w-3" />
              <Link href={`/projects/${projectId}`} className="hover:text-emerald-500 transition-colors">
                Chi tiết
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-600">Bảng</span>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
               {canManageBoard && (
                 <button
                   type="button"
                   onClick={() => {
                     setIsBackgroundPopoverOpen(false);
                     setApplyTemplateModalOpen(true);
                     refreshBoardTemplates();
                   }}
                   className="px-3 py-2 bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl text-slate-600 hover:bg-white transition-all shadow-sm flex items-center gap-2"
                   title="Template cột bảng"
                 >
                   <Wand2 className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold hidden sm:inline-block">Mẫu cột</span>
                 </button>
               )}

               {canManageMembers && (
                 <button
                   type="button"
                   onClick={() => setIsMemberModalOpen(true)}
                   className="px-3 py-2 bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl text-slate-600 hover:bg-white transition-all shadow-sm flex items-center gap-2"
                  title="Quản lý thành viên"
                 >
                   <Users className="h-4 w-4" />
                  <span className="text-sm font-bold hidden sm:inline-block">Thành viên</span>
                 </button>
               )}

               {/* Settings Gear Dropdown */}
               <div className="relative">
                 <button 
                   onClick={() => setIsBackgroundPopoverOpen(p => p ? false : true)}
                   className={`p-2 backdrop-blur-sm border rounded-xl transition-all shadow-sm ${
                     isBackgroundPopoverOpen
                       ? 'bg-white border-slate-300 text-slate-800'
                       : 'bg-white/80 border-white/60 text-slate-600 hover:bg-white'
                   }`}
                  title="Cài đặt bảng"
                 >
                   <Settings className="h-4 w-4" />
                 </button>

                 {/* Dropdown menu */}
                 {isBackgroundPopoverOpen && (
                   <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                     {/* Dropdown Header */}
                     <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Cài đặt bảng</p>
                     </div>

                     {/* Dropdown Items */}
                     <div className="py-2">
                       {canManageBoard ? (
                         <button
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             setIsBackgroundPopoverOpen(false);
                             setApplyTemplateModalOpen(true);
                             refreshBoardTemplates();
                           }}
                           className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 font-medium transition-colors"
                         >
                           <LayoutTemplate className="h-4 w-4 text-amber-500" />
                          <span className="whitespace-nowrap">Mẫu cột</span>
                         </button>
                       ) : null}
                       <div className="relative group">
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             // Toggle sub-popover by setting a specific key
                             setIsBackgroundPopoverOpen('bg');
                           }}
                           className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 font-medium transition-colors"
                         >
                           <ImageIcon className="h-4 w-4 text-slate-400" />
                          <span className="whitespace-nowrap">Đổi nền bảng</span>
                           {effectiveBoardBackground && (
                             <div
                               className="ml-auto w-5 h-5 rounded-full border border-slate-200 shadow-sm overflow-hidden"
                               style={getBoardBackgroundStyle(effectiveBoardBackground)}
                             />
                           )}
                         </button>
                       </div>
                     </div>

                     {/* Click outside backdrop */}
                     <div className="fixed inset-0 -z-10" onClick={() => setIsBackgroundPopoverOpen(false)} />
                   </div>
                 )}

                 {/* Background Popover sub-panel */}
                 {isBackgroundPopoverOpen === 'bg' && projectId && boardViewApiPath && (
                   <BoardBackgroundPopover
                     boardViewPath={boardViewApiPath}
                     currentBackground={effectiveBoardBackground}
                     onClose={() => setIsBackgroundPopoverOpen(false)}
                     onBackgroundChange={(bg) => {
                       lastBgUpdateRef.current = Date.now();
                       setMyBoardView((prev) => ({ ...(prev || {}), background: bg }));
                       setIsBackgroundPopoverOpen(false);
                     }}
                   />
                 )}
               </div>
            </div>
          }
        />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-10 pb-3 flex justify-end">
          <div className="relative w-full max-w-sm group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Tìm kiếm công việc..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/90 backdrop-blur-sm border border-slate-200/90 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all shadow-sm"
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
           <ProjectBoard 
              projectId={projectId!} 
              projectName={project?.name || 'Bảng dự án'}
              tasks={tasks}
              boardLists={mergedBoardLists}
              canManageBoard={canManageBoard}
              persistColumnColorPersonal={savePersonalColumnColor}
              onRefreshBoardLists={refreshBoardListsOnly}
              onRefreshBoardTemplates={refreshBoardTemplates}
              searchTerm={boardSearch}
              onTaskUpdate={fetchData} 
              onOptimisticUpdate={handleOptimisticUpdate}
              onOptimisticTaskPatch={handleOptimisticTaskPatch}
              onUpdateTaskAppearance={handleUpdateTaskAppearance}
              onOptimisticReorder={handleOptimisticReorder}
              onOptimisticTaskCopy={handleOptimisticTaskCopy}
              onCopyTaskConfirm={handleCopyTaskConfirm}
              onCopyTaskRollback={handleCopyTaskRollback}
              onTaskClick={(task) => setSelectedTask(task)}
              onAddTask={(listId, mapsToStatus) => {
                setPreselectedBoardListId(listId);
                setPreselectedStatus(mapsToStatus);
                setIsCreateModalOpen(true);
              }}
           />
        </div>
        </div>
      </div>
      
      {applyTemplateModalOpen && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Đóng"
            disabled={applyHeaderSubmitting}
            onClick={() => {
              if (!applyHeaderSubmitting) setApplyTemplateModalOpen(false);
            }}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-template-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="apply-template-title" className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-amber-600 shrink-0" />
              Mẫu cột
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Thay toàn bộ cột bảng. Thẻ chưa lưu trữ được gán vào cột cùng trạng thái (hoặc cột mặc định nếu không khớp).
            </p>
            {boardTemplateOptions.length === 0 ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-amber-900 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                  Chưa có template. Đảm bảo backend đã chạy và có template gốc; hoặc dùng « Lưu template bảng » ở cột cuối bên phải trên bảng, rồi « Thử tải lại » bên dưới.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => refreshBoardTemplates()}
                    className="flex-1 min-w-[8rem] rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Thử tải lại
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyTemplateModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={openHeaderApplyConfirm} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="apply-template-select" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Mẫu
                  </label>
                  <select
                    id="apply-template-select"
                    value={applyHeaderTemplateId}
                    onChange={(e) => setApplyHeaderTemplateId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {boardTemplateOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                        {opt.isBuiltIn === true ? '' : ' — của bạn'}
                      </option>
                    ))}
                  </select>
                </div>
                {applyHeaderTemplateId ? (
                  <BoardTemplatePreview
                    lists={headerSelectedTemplateLists}
                    templateId={applyHeaderTemplateId}
                  />
                ) : null}
                {headerSelectedTemplateOption ? (
                  <button
                    type="button"
                    onClick={() => {
                      setApplyTemplateModalOpen(false);
                      setEditTemplateId(applyHeaderTemplateId);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 py-2.5 text-sm font-bold text-indigo-800 hover:bg-indigo-100"
                  >
                    <Pencil className="h-4 w-4 shrink-0" />
                    {headerSelectedTemplateOption.isBuiltIn === true
                      ? 'Chỉnh và lưu thành template cá nhân'
                      : 'Chỉnh sửa template này'}
                  </button>
                ) : null}
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    disabled={applyHeaderSubmitting}
                    onClick={() => setApplyTemplateModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={applyHeaderSubmitting || !applyHeaderTemplateId}
                    className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {applyHeaderSubmitting ? '…' : 'Áp dụng template'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <EditBoardTemplateModal
        isOpen={!!editTemplateId}
        template={templateBeingEdited}
        onClose={() => setEditTemplateId(null)}
        onSaved={() => {
          refreshBoardTemplates();
          setEditTemplateId(null);
        }}
      />

      <ConfirmModal
        isOpen={applyHeaderConfirmOpen}
        title="Áp dụng template?"
        description="Thay toàn bộ cột bảng bằng template đã chọn. Thẻ chưa lưu trữ sẽ được xếp vào cột đúng trạng thái; trạng thái không có trong template sẽ gán vào « Chờ xử lý » hoặc cột đầu tiên."
        confirmLabel="Áp dụng"
        cancelLabel="Hủy"
        variant="primary"
        isLoading={applyHeaderSubmitting}
        onConfirm={executeHeaderApplyTemplate}
        onCancel={() => {
          if (!applyHeaderSubmitting) setApplyHeaderConfirmOpen(false);
        }}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal 
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        projectId={projectId as string}
        projectName={project?.name || 'Bảng dự án'}
        boardTasks={tasks.map((t) => ({ id: t.id, status: t.status, boardListId: t.boardListId }))}
        boardListsForCopy={boardListsForCopy}
        onOptimisticTaskCopy={handleOptimisticTaskCopy}
        onCopyTaskConfirm={handleCopyTaskConfirm}
        onCopyTaskRollback={handleCopyTaskRollback}
        onUpdate={fetchData}
        onDataChange={handleLocalTaskUpdate}
        projectMembersList={members}
        projectOwnerId={project?.ownerId}
        canDuplicateCard={canManageBoard}
      />

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId as string}
        departments={[]} // Fetch if needed, but usually empty for project-scoped tasks
        members={members}
        boardLists={boardListsForCopy}
        onSuccess={fetchData}
        initialStatus={preselectedStatus}
        initialBoardListId={preselectedBoardListId}
        projectOwnerId={project?.ownerId}
      />
      
      {project && canManageMembers && (
        <ManageMemberModal
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          projectId={projectId as string}
          departmentId={project.owner?.departmentId}
          onSuccess={fetchData}
        />
      )}
    </MainLayout>
  );
}
