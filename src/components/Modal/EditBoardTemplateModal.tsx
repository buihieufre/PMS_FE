import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios';
import type { BoardTemplateOption } from '@/lib/boardTemplateOption';
import { TEMPLATE_COLUMN_COLOR_PRESETS, TEMPLATE_MAP_STATUS_OPTIONS } from '@/lib/boardTemplateEditConstants';
import { BoardTemplatePreview } from '@/components/Project/BoardTemplatePreview';

export type EditBoardTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  template: BoardTemplateOption | null;
  onSaved: () => void;
};

type EditableColumn = {
  name: string;
  mapsToStatus: string;
  colorClass: string;
};

function columnsFromTemplate(t: BoardTemplateOption): EditableColumn[] {
  return [...t.lists]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      name: l.name,
      mapsToStatus: l.mapsToStatus,
      colorClass: l.colorClass || TEMPLATE_COLUMN_COLOR_PRESETS[0].value,
    }));
}

export function EditBoardTemplateModal({ isOpen, onClose, template, onSaved }: EditBoardTemplateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<EditableColumn[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!template || !isOpen) return;
    setName(template.name);
    setDescription(typeof template.description === 'string' ? template.description : '');
    setColumns(columnsFromTemplate(template));
  }, [template, isOpen]);

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= columns.length) return;
    setColumns((prev) => {
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const addColumn = () => {
    if (columns.length >= 24) {
      toast.error('Tối đa 24 cột');
      return;
    }
    setColumns((prev) => [
      ...prev,
      {
        name: 'Cột mới',
        mapsToStatus: 'PENDING',
        colorClass: TEMPLATE_COLUMN_COLOR_PRESETS[0].value,
      },
    ]);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) {
      toast.error('Giữ ít nhất một cột');
      return;
    }
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template?.id || saving) return;
    if (!name.trim()) {
      toast.error('Nhập tên template');
      return;
    }
    setSaving(true);
    try {
      const lists = columns.map((c, sortOrder) => ({
        name: c.name.trim(),
        sortOrder,
        mapsToStatus: c.mapsToStatus,
        colorClass: c.colorClass.trim() || null,
      }));
      if (template.isBuiltIn === true) {
        await axiosInstance.post(`/projects/board-templates/${template.id}/fork`, {
          name: name.trim(),
          description: description.trim() || null,
          lists,
        });
        toast.success('Đã lưu thành template cá nhân');
      } else {
        await axiosInstance.patch(`/projects/board-templates/${template.id}`, {
          name: name.trim(),
          description: description.trim() || null,
          lists,
        });
        toast.success('Đã cập nhật template');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; message?: string } } };
      toast.error(ax.response?.data?.error || ax.response?.data?.message || 'Không lưu được template');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = template != null;
  const isForkMode = template?.isBuiltIn === true;
  const previewLists = columns.map((c, sortOrder) => ({
    name: c.name.trim() || 'Cột chưa đặt tên',
    sortOrder,
    colorClass: c.colorClass || TEMPLATE_COLUMN_COLOR_PRESETS[0].value,
    mapsToStatus: c.mapsToStatus,
  }));

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[20000]" onClose={() => !saving && onClose()}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <Dialog.Title className="text-lg font-bold text-slate-900">Chỉnh sửa template</Dialog.Title>
                {!canEdit ? (
                  <p className="mt-3 text-sm text-slate-600">Không tìm thấy template để chỉnh sửa.</p>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    {isForkMode ? (
                      <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                        Đây là template hệ thống. Khi lưu, hệ thống sẽ tạo template cá nhân của bạn từ phiên bản đã chỉnh.
                      </p>
                    ) : null}
                    <BoardTemplatePreview
                      lists={previewLists}
                      templateId={template?.id || 'preview'}
                      mode="board"
                    />
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tên template</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Mô tả (tuỳ chọn)</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="mt-1 w-full min-h-[4rem] resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Ghi chú ngắn cho template…"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Cột Kanban</span>
                        <button
                          type="button"
                          onClick={addColumn}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Thêm cột
                        </button>
                      </div>
                      <ul className="mt-2 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                        {columns.map((col, index) => (
                          <li key={index} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2">
                            <div className="flex gap-2">
                              <input
                                value={col.name}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setColumns((prev) => prev.map((c, i) => (i === index ? { ...c, name: v } : c)));
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                placeholder="Tên cột"
                                required
                              />
                              <div className="flex shrink-0 flex-col gap-0.5">
                                <button
                                  type="button"
                                  aria-label="Lên"
                                  disabled={index === 0}
                                  onClick={() => move(index, -1)}
                                  className="rounded border border-slate-200 p-0.5 hover:bg-white disabled:opacity-40"
                                >
                                  <ChevronUp className="h-4 w-4 text-slate-600" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Xuống"
                                  disabled={index === columns.length - 1}
                                  onClick={() => move(index, 1)}
                                  className="rounded border border-slate-200 p-0.5 hover:bg-white disabled:opacity-40"
                                >
                                  <ChevronDown className="h-4 w-4 text-slate-600" />
                                </button>
                              </div>
                              <button
                                type="button"
                                aria-label="Xóa cột"
                                onClick={() => removeColumn(index)}
                                className="shrink-0 rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <select
                                value={col.mapsToStatus}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setColumns((prev) =>
                                    prev.map((c, i) => (i === index ? { ...c, mapsToStatus: v } : c))
                                  );
                                }}
                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium"
                              >
                                {TEMPLATE_MAP_STATUS_OPTIONS.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.title} ({o.id})
                                  </option>
                                ))}
                              </select>
                              <select
                                value={
                                  TEMPLATE_COLUMN_COLOR_PRESETS.some((p) => p.value === col.colorClass)
                                    ? col.colorClass
                                    : TEMPLATE_COLUMN_COLOR_PRESETS[0].value
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setColumns((prev) =>
                                    prev.map((c, i) => (i === index ? { ...c, colorClass: v } : c))
                                  );
                                }}
                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium"
                              >
                                {TEMPLATE_COLUMN_COLOR_PRESETS.map((p) => (
                                  <option key={p.value} value={p.value}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[10px] text-slate-500">
                        Thứ tự từ trên xuống = trái sang phải trên bảng. Mỗi cột gắn một trạng thái nghiệp vụ để xếp thẻ đúng.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isForkMode ? 'Lưu thành template cá nhân' : 'Lưu thay đổi'}
                      </button>
                    </div>
                  </form>
                )}
                {!canEdit && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600"
                  >
                    Đóng
                  </button>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
