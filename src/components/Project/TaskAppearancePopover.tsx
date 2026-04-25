import React, { useState, useRef } from 'react';
import {
  X,
  ChevronLeft,
  Check,
  Link as LinkIcon,
  Upload,
  Image as ImageIcon,
  Search,
} from 'lucide-react';
import { isTaskCoverImageUrl, type TaskCoverMode } from '@/lib/boardBackgroundStyle';

const COVER_LAYOUT: TaskCoverMode = 'SPLIT';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

const GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#0093E9,#80D0C7)',
  'linear-gradient(135deg,#11998e,#38ef7d)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#f7971e,#ffd200)',
  'linear-gradient(135deg,#243B55,#141E30)',
  'linear-gradient(135deg,#cb2d3e,#ef473a)',
  'linear-gradient(135deg,#134E5E,#71B280)',
];

/** Màu lưới — gần Trello (xanh, vàng, cam, đỏ, tím, xanh dương, xanh nhạt, xanh chanh, hồng, xám) */
const TRELLO_LIKE_SWATCHES: { bg: string; text: string }[] = [
  { bg: '#4bce97', text: '#0f172a' },
  { bg: '#e2b203', text: '#0f172a' },
  { bg: '#faa53d', text: '#0f172a' },
  { bg: '#f87462', text: '#ffffff' },
  { bg: '#9f8fef', text: '#0f172a' },
  { bg: '#579dff', text: '#0f172a' },
  { bg: '#6cc3e0', text: '#0f172a' },
  { bg: '#4aed78', text: '#0f172a' },
  { bg: '#f79dc7', text: '#0f172a' },
  { bg: '#6b778c', text: '#ffffff' },
];

const UNSPLASH_SUGGESTIONS: string[] = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=220&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5e3b4b55b8?w=400&h=220&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=220&fit=crop&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=220&fit=crop&q=80',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=400&h=220&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&h=220&fit=crop&q=80',
];

export interface TaskAppearanceUpdate {
  background?: string;
  textColor?: string;
  coverMode?: TaskCoverMode | null;
}

export interface TaskAppearancePopoverProps {
  currentBackground?: string;
  currentTextColor?: string;
  currentCoverMode?: TaskCoverMode | null;
  onUpdate: (data: TaskAppearanceUpdate) => void;
  onClose?: () => void;
  onBack?: () => void;
  projectId?: string;
  taskId?: string;
}

export const TaskAppearancePopover: React.FC<TaskAppearancePopoverProps> = ({
  currentBackground,
  currentTextColor,
  currentCoverMode,
  onUpdate,
  onClose,
  onBack,
  projectId,
  taskId,
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'gradient' | 'link'>('gradient');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [colorblind, setColorblind] = useState(false);

  const hasCover = Boolean(currentBackground && String(currentBackground).trim());

  const apply = (u: TaskAppearanceUpdate) => {
    onUpdate({ ...u, coverMode: u.coverMode ?? COVER_LAYOUT });
  };

  const pickGradient = (g: string) => {
    apply({ background: g, textColor: '#ffffff', coverMode: COVER_LAYOUT });
  };

  const pickColor = (bg: string, text: string) => {
    apply({ background: bg, textColor: text, coverMode: COVER_LAYOUT });
  };

  const applyLink = () => {
    const u = inputUrl.trim();
    if (!u) return;
    const asImg = isTaskCoverImageUrl(u);
    apply({
      background: u,
      textColor: asImg ? (currentTextColor || '#ffffff') : '#ffffff',
      coverMode: COVER_LAYOUT,
    });
  };

  const removeCover = () => {
    onUpdate({ background: undefined, textColor: '#0f172a', coverMode: null });
  };

  const onPickUnsplash = (url: string) => {
    apply({ background: url, textColor: '#ffffff', coverMode: COVER_LAYOUT });
  };

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !projectId || !taskId) {
      if (!projectId || !taskId) toast.error('Cần mở thẻ trong dự án để tải ảnh lên');
      return;
    }
    if (!f.type.startsWith('image/')) {
      toast.error('Chỉ hỗ trợ tệp ảnh');
      return;
    }

    const revert: TaskAppearanceUpdate = {
      background: currentBackground,
      textColor: (currentTextColor as string) ?? '#0f172a',
      coverMode: currentCoverMode ?? null,
    };

    const previewUrl = URL.createObjectURL(f);
    apply({ background: previewUrl, textColor: '#ffffff', coverMode: COVER_LAYOUT });

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', f);
      const res = await axiosInstance.post(`/projects/${projectId}/tasks/${taskId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileUrl = res.data?.attachment?.fileUrl;
      if (!fileUrl) throw new Error('NO_URL');
      URL.revokeObjectURL(previewUrl);
      apply({ background: fileUrl, textColor: '#ffffff', coverMode: COVER_LAYOUT });
      toast.success('Đã đặt ảnh bìa');
    } catch {
      URL.revokeObjectURL(previewUrl);
      onUpdate(revert);
      toast.error('Tải ảnh thất bại');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-[min(100vw,22rem)] max-h-[min(88vh,560px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-slate-200 bg-white px-2 py-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            title="Trở lại"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h4 className="flex-1 text-center text-sm font-bold text-slate-800">Ảnh bìa</h4>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!onClose && <span className="w-8" aria-hidden />}
      </div>

      <div className="space-y-4 p-3">
        <button
          type="button"
          onClick={removeCover}
          disabled={!hasCover}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Xoá ảnh bìa
        </button>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Màu sắc</p>
          <div
            className="grid grid-cols-5 gap-2"
            style={
              colorblind
                ? { filter: 'saturate(0.7) contrast(1.08)' }
                : undefined
            }
          >
            {TRELLO_LIKE_SWATCHES.map((c) => (
              <button
                key={c.bg}
                type="button"
                onClick={() => pickColor(c.bg, c.text)}
                className="relative h-9 rounded-lg border-2 border-transparent transition hover:scale-105"
                style={{
                  background: c.bg,
                  borderColor: currentBackground === c.bg ? '#0f172a' : 'transparent',
                  boxShadow: currentBackground === c.bg ? '0 0 0 1px #0f172a' : undefined,
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[9px] text-slate-400">Bật chế độ thân thiện màu sắc (giảm bão hòa)</span>
            <button
              type="button"
              onClick={() => setColorblind((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition ${colorblind ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  colorblind ? 'left-4' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Các tệp đính kèm</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !projectId || !taskId}
            className="mb-1 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Đang tải…' : 'Tải lên ảnh bìa'}
          </button>
          <p className="text-[10px] text-slate-400">Mẹo: Kéo ảnh vào thẻ trên bảng (sau khi mở rộng tính năng) hoặc tải lên từ đây.</p>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Ảnh từ Unsplash</p>
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            {UNSPLASH_SUGGESTIONS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => onPickUnsplash(url)}
                className="relative aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-slate-200/80 transition hover:ring-2 hover:ring-slate-400"
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.open('https://unsplash.com', '_blank', 'noopener,noreferrer')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Search className="h-3.5 w-3.5" />
            Tìm kiếm ảnh
          </button>
        </div>

        <div className="h-px bg-slate-100" />

        <div>
          <div className="mb-2 flex gap-1 rounded-xl bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('gradient')}
              className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold ${
                activeTab === 'gradient' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Dải màu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold ${
                activeTab === 'link' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Dán liên kết
            </button>
          </div>
          {activeTab === 'gradient' && (
            <div className="grid grid-cols-4 gap-1.5">
              {GRADIENTS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => pickGradient(g)}
                  className="relative h-9 rounded-lg text-[0] transition hover:ring-2 hover:ring-slate-400"
                  style={{ background: g }}
                >
                  {currentBackground === g && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'link' && (
            <div className="space-y-2">
              <div className="relative">
                <LinkIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="Dán link ảnh (https://…)"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <button
                type="button"
                onClick={applyLink}
                disabled={!inputUrl.trim()}
                className="w-full rounded-xl bg-slate-900 py-2 text-[10px] font-bold uppercase tracking-wide text-white disabled:opacity-40"
              >
                Áp dụng
              </button>
            </div>
          )}
        </div>

        {hasCover && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[10px] font-bold text-slate-500">Màu chữ tiêu đề</span>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => onUpdate({ textColor: '#ffffff' })}
                className={`px-2 py-1 text-[9px] font-bold ${
                  (currentTextColor || '#fff').toLowerCase() === '#ffffff' ? 'rounded-md bg-white shadow' : 'text-slate-500'
                }`}
              >
                Sáng
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ textColor: '#0f172a' })}
                className={`px-2 py-1 text-[9px] font-bold ${
                  (currentTextColor || '').toLowerCase() === '#0f172a' ? 'rounded-md bg-white shadow' : 'text-slate-500'
                }`}
              >
                Tối
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 rounded-xl bg-amber-50/80 px-2 py-1.5 text-[9px] text-amber-900/80">
          <ImageIcon className="h-3.5 w-3.5 shrink-0" />
          <span>Bìa ảnh hoặc màu hiển thị dải trên cùng; phần nội dung thẻ nằm trên nền trắng.</span>
        </div>
      </div>
    </div>
  );
};

export default TaskAppearancePopover;
