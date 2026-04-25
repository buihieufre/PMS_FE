import React, { useState, useEffect, Fragment } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { Check, Plus, Pencil, X, Search } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { getSocket, useSocket } from '@/hooks/useSocket';

interface Label {
  id: string;
  name: string | null;
  color: string;
}

interface LabelPopoverProps {
  projectId: string;
  taskId?: string;
  selectedLabels: Label[];
  onUpdate: (newLabelIds: string[], updatedLabels: Label[]) => void;
}

const DEFAULT_COLORS = [
  '#4bce97', '#e2b203', '#faa53d', '#f87462', '#9f8fef', '#579dff'
];

export default function LabelPopover({ projectId, taskId, selectedLabels, onUpdate }: LabelPopoverProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { emit } = useSocket(projectId);
  // Edit / Create State
  const [isEditing, setIsEditing] = useState(false);
  const [editLabelId, setEditLabelId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_COLORS[0]);

  useEffect(() => {
    fetchLabels();
    if (typeof window === 'undefined') return;
    const s = getSocket();
    const hCreate = (label: Label) => {
      setLabels((prev) => (prev.some((l) => l.id === label.id) ? prev : [...prev, label]));
    };
    const hUpdate = (label: Label) => {
      setLabels((prev) => prev.map((l) => (l.id === label.id ? label : l)));
    };
    const hDelete = ({ labelId }: { labelId: string }) => {
      setLabels((prev) => prev.filter((l) => l.id !== labelId));
    };
    s.on('label:created', hCreate);
    s.on('label:updated', hUpdate);
    s.on('label:deleted', hDelete);
    return () => {
      s.off('label:created', hCreate);
      s.off('label:updated', hUpdate);
      s.off('label:deleted', hDelete);
    };
  }, [projectId]);

  const fetchLabels = async () => {
    try {
      const res = await axiosInstance.get(`/projects/${projectId}/labels`);
      setLabels(res.data);
    } catch (error) {
      console.error('Failed to fetch labels', error);
    }
  };

  const handleToggleLabel = (label: Label) => {
    const isSelected = selectedLabels.some(l => l.id === label.id);
    const newLabelIds = isSelected 
      ? selectedLabels.filter(l => l.id !== label.id).map(l => l.id)
      : [...selectedLabels.map(l => l.id), label.id];

    const updatedLabels = isSelected
      ? selectedLabels.filter(l => l.id !== label.id)
      : [...selectedLabels, label];
      
    // Let parent handle the socket emit and optimistic updates
    onUpdate(newLabelIds, updatedLabels);
  };

  const handleSaveLabel = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error('Vui lòng nhập tên nhãn');
      return;
    }

    // Check for duplicate names (excluding current editing label)
    const isDuplicate = labels.some(l => l.name?.toLowerCase() === trimmedName.toLowerCase() && l.id !== editLabelId);
    if (isDuplicate) {
      toast.error('Nhãn có tên này đã tồn tại!');
      return;
    }

    // Check for duplicate colors
    const isColorDuplicate = labels.some(l => l.color === editColor && l.id !== editLabelId);
    if (isColorDuplicate) {
      toast.error('Màu này đã được sử dụng cho nhãn khác!');
      return;
    }

    setLoading(true);
    if (editLabelId) {
      emit('label:update', { projectId, labelId: editLabelId, name: trimmedName, color: editColor }, (response: any) => {
        setLoading(false);
        if (response.status === 'success') {
          goBack();
          toast.success('Cập nhật nhãn thành công');
        } else {
          toast.error('Lưu nhãn thất bại');
        }
      });
    } else {
      emit('label:create', { projectId, name: trimmedName, color: editColor }, (response: any) => {
        setLoading(false);
        if (response.status === 'success') {
          goBack();
          toast.success('Đã tạo nhãn mới');
        } else {
          toast.error('Lưu nhãn thất bại');
        }
      });
    }
  };

  const handleDeleteLabel = async () => {
    if (!editLabelId) return;
    setLoading(true);

    emit('label:delete', { projectId, labelId: editLabelId }, (response: any) => {
      setLoading(false);
      if (response.status === 'success') {
        // Remove from selected if it was selected - optimistically update parent
        if (selectedLabels.some(l => l.id === editLabelId)) {
          const filteredLabels = selectedLabels.filter(l => l.id !== editLabelId);
          onUpdate(filteredLabels.map(l => l.id), filteredLabels);
        }
        goBack();
        toast.success('Đã xóa nhãn');
      } else {
        toast.error('Xóa nhãn thất bại');
      }
    });
  };

  const goBack = () => {
    setIsEditing(false);
    setEditLabelId(null);
    setEditName('');
    setEditColor(DEFAULT_COLORS[0]);
  };

  const filteredLabels = labels.filter(l => (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Popover className="relative inline-block text-left">
      <Popover.Button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-md transition-colors">
        Nhãn
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
        <Popover.Panel className="absolute z-50 mt-2 w-72 bg-white rounded-xl shadow-xl ring-1 ring-slate-200 p-3 transform -translate-x-1/2 left-1/2 sm:translate-x-0 sm:left-0 focus:outline-none">
          {({ close }) => !isEditing ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700 text-center flex-1">Nhãn</span>
                <button onClick={() => close()} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-2 top-2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Tìm nhãn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="text-xs font-semibold text-slate-500 mb-2">Nhãn</div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {filteredLabels.map((label) => {
                  const isSelected = selectedLabels.some(l => l.id === label.id);
                  return (
                    <div key={label.id} className="flex items-center gap-1 group">
                      <div className="flex items-center justify-center p-1 cursor-pointer shrink-0" onClick={() => { if (!loading) handleToggleLabel(label); }}>
                         <input 
                            type="checkbox" 
                            checked={isSelected} 
                            readOnly 
                            className="w-4 h-4 rounded border-2 border-slate-300 text-blue-500 focus:ring-blue-500/20 cursor-pointer transition-all" 
                         />
                      </div>
                      <button
                        onClick={() => handleToggleLabel(label)}
                        className="flex-1 flex items-center h-8 px-3 rounded-md transition-all text-white font-bold text-sm text-left truncate relative"
                        style={{ backgroundColor: label.color }}
                        disabled={loading}
                      >
                        <span className="truncate drop-shadow-sm">{label.name}</span>
                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity rounded-md" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setEditLabelId(label.id);
                          setEditName(label.name || '');
                          setEditColor(label.color);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md shrink-0 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditLabelId(null);
                  setEditName('');
                  setEditColor(DEFAULT_COLORS[0]);
                }}
                className="w-full mt-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-md transition-colors"
              >
                Tạo nhãn mới
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button onClick={goBack} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" /> {/* Should be back arrow ideally, but X works for discard */}
                </button>
                <span className="text-sm font-semibold text-slate-700 text-center flex-1">
                  {editLabelId ? 'Sửa nhãn' : 'Tạo nhãn'}
                </span>
                <button onClick={() => close()} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <div 
                  className="w-full h-8 rounded-md mb-4 flex items-center px-3"
                  style={{ backgroundColor: editColor }}
                >
                  <span className="text-white font-bold text-sm truncate">{editName || ' '}</span>
                </div>

                <label className="block text-xs font-bold text-slate-600 mb-1">Tiêu đề</label>
                <input 
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                  autoFocus
                />

                <label className="block text-xs font-bold text-slate-600 mb-1">Màu sắc</label>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {DEFAULT_COLORS.map(c => {
                    const isTaken = labels.some(l => l.color === c && l.id !== editLabelId);
                    return (
                      <button
                        key={c}
                        onClick={() => !isTaken && setEditColor(c)}
                        disabled={isTaken}
                        className={`h-8 rounded-md flex items-center justify-center transition-transform ${isTaken ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-105 cursor-pointer'}`}
                        style={{ backgroundColor: c }}
                        title={isTaken ? 'Màu này đã được sử dụng' : ''}
                      >
                        {editColor === c && <Check className="w-4 h-4 text-white" />}
                        {isTaken && editColor !== c && <div className="absolute inset-0 bg-white/20 rounded-md" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center gap-2">
                  <button
                    onClick={handleSaveLabel}
                    disabled={loading}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center"
                  >
                    {loading ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  {editLabelId && (
                    <button
                      onClick={handleDeleteLabel}
                      disabled={loading}
                      className="py-1.5 px-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium text-sm rounded-md transition-colors"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
