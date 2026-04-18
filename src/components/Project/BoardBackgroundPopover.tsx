import { useState, useRef, useEffect } from 'react';
import { Image, Palette, Link, Upload, X, Check, Loader2 } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';

interface BoardBackgroundPopoverProps {
  projectId: string;
  currentBackground?: string | null;
  onClose: () => void;
  onBackgroundChange: (bg: string | null) => void;
}

const PRESET_GRADIENTS = [
  { label: 'Sky', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { label: 'Ocean', value: 'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)' },
  { label: 'Emerald', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { label: 'Sunset', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { label: 'Peach', value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { label: 'Deep Space', value: 'linear-gradient(135deg, #243B55 0%, #141E30 100%)' },
  { label: 'Mango', value: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' },
  { label: 'Royal', value: 'linear-gradient(135deg, #141E30 0%, #243B55 100%)' },
  { label: 'Rosewood', value: 'linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%)' },
  { label: 'Midnight', value: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' },
  { label: 'Ash', value: 'linear-gradient(135deg, #e0e0e0 0%, #b0bec5 100%)' },
  { label: 'Forest', value: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)' },
];

const PRESET_COLORS = [
  '#0f172a', '#1e3a5f', '#064e3b', '#78350f', '#4c0519',
  '#1e1b4b', '#f8fafc', '#fef3c7', '#f0fdf4', '#eff6ff',
  '#fdf4ff', '#fff1f2',
];

type Tab = 'gradient' | 'color' | 'link' | 'upload';

export default function BoardBackgroundPopover({
  projectId,
  currentBackground,
  onClose,
  onBackgroundChange,
}: BoardBackgroundPopoverProps) {
  const [activeTab, setActiveTab] = useState<Tab>('gradient');
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { emit } = useSocket(projectId);
  const fileRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const applyBackground = async (value: string | null, file?: File) => {
    if (file) {
      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append('image', file);
        const res = await axiosInstance.patch(`/projects/${projectId}/background`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const newBg = res.data.project.background;
        onBackgroundChange(newBg);
        emit('project:changeBackground', { projectId, background: newBg });
        toast.success('Board background updated!');
      } catch (err) {
        toast.error('Failed to update background');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Optimistic Update
      onBackgroundChange(value);
      
      // Emit via Socket for instant feedback to others
      emit('project:changeBackground', { 
        projectId, 
        background: value,
        updatedAt: Date.now(),
        senderId: (emit as any).socket?.id // Try to get socket id from emit context or just let backend handle it
      });
      
      // Persistence in background (silent)
      try {
        await axiosInstance.patch(`/projects/${projectId}/background`, { background: value });
      } catch (err) {
        console.error('Failed to persist background change:', err);
        // We could rollback if critical, but for BG it's usually fine
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    applyBackground(null, file);
  };

  const handleUrlApply = () => {
    if (!urlInput.trim()) return;
    applyBackground(urlInput.trim());
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'gradient', label: 'Gradient', icon: <Palette className="h-3.5 w-3.5" /> },
    { id: 'color', label: 'Color', icon: <div className="h-3.5 w-3.5 rounded-full border border-current" /> },
    { id: 'link', label: 'Image URL', icon: <Link className="h-3.5 w-3.5" /> },
    { id: 'upload', label: 'Upload', icon: <Upload className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-bold text-slate-700">Board Background</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-bold transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-2xl">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}

        {activeTab === 'gradient' && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Choose a Gradient</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_GRADIENTS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => applyBackground(g.value)}
                  title={g.label}
                  className="relative h-12 rounded-xl overflow-hidden border-2 border-transparent hover:border-white hover:scale-105 transition-all shadow-sm"
                  style={{ background: g.value }}
                >
                  {currentBackground === g.value && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'color' && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Solid Color</p>
            <div className="grid grid-cols-6 gap-2 mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => applyBackground(c)}
                  className="relative h-9 w-9 rounded-xl border-2 border-slate-200 hover:scale-110 transition-all shadow-sm"
                  style={{ backgroundColor: c }}
                >
                  {currentBackground === c && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-3.5 w-3.5" style={{ color: c === '#f8fafc' || c.startsWith('#fef') || c.startsWith('#f0f') || c.startsWith('#eff') || c.startsWith('#fff') ? '#374151' : '#ffffff' }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-9 rounded-lg border border-slate-200 cursor-pointer"
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <span className="text-xs text-slate-500 flex-1">Pick a custom color</span>
              <button
                onClick={() => applyBackground(urlInput || '#1e3a5f')}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {activeTab === 'link' && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Paste an Image URL</p>
            <div className="space-y-3">
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlApply()}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
              {urlInput && (
                <div
                  className="h-20 rounded-xl border border-slate-200 bg-cover bg-center bg-no-repeat overflow-hidden"
                  style={{ backgroundImage: `url(${urlInput})` }}
                />
              )}
              <button
                onClick={handleUrlApply}
                disabled={!urlInput.trim()}
                className="w-full py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Apply Image
              </button>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Upload from Device</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all text-slate-400 hover:text-blue-600 gap-2"
            >
              <Upload className="h-6 w-6" />
              <span className="text-xs font-bold">Click to browse</span>
              <span className="text-[10px]">PNG, JPG, WEBP — max 10MB</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer - Clear button */}
      <div className="px-4 pb-4">
        <button
          onClick={() => applyBackground(null)}
          className="w-full py-2 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors"
        >
          Remove Background
        </button>
      </div>
    </div>
  );
}
