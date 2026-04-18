import React, { useState } from 'react';
import { Palette, Check, Image as ImageIcon, Link as LinkIcon, Upload } from 'lucide-react';

interface TaskAppearancePopoverProps {
  currentBackground?: string;
  currentTextColor?: string;
  onUpdate: (data: { background?: string; textColor?: string }) => void;
}

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

const SOLID_COLORS = [
  '#0f172a', '#1e3a5f', '#064e3b', '#78350f', '#4c0519', '#1e1b4b',
  '#f8fafc', '#fef9c3', '#f0fdf4', '#eff6ff', '#fdf4ff', '#fff1f2'
];

const LIGHT_COLORS = ['#f8fafc', '#fef9c3', '#f0fdf4', '#eff6ff', '#fdf4ff', '#fff1f2'];

export const TaskAppearancePopover: React.FC<TaskAppearancePopoverProps> = ({
  currentBackground,
  currentTextColor,
  onUpdate
}) => {
  const [tab, setTab] = useState<'gradient' | 'color' | 'link'>('gradient');
  const [inputUrl, setInputUrl] = useState('');
  const [customColor, setCustomColor] = useState('#6366f1');

  return (
    <div className="w-64 p-4 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-slate-100 rounded-lg">
          <Palette className="h-4 w-4 text-slate-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Giao diện thẻ</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Tùy chỉnh màu nền và chữ</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
        {(['gradient', 'color', 'link'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
             {t === 'gradient' ? 'Gradients' : t === 'color' ? 'Màu sắc' : 'Ảnh/Link'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {tab === 'gradient' && (
          <div className="grid grid-cols-4 gap-2">
            {GRADIENTS.map((g) => (
              <button
                key={g}
                onClick={() => onUpdate({ background: g, textColor: '#ffffff' })}
                className="relative h-10 rounded-xl transition-all hover:scale-105 border-2 group shadow-sm"
                style={{
                  background: g,
                  borderColor: currentBackground === g ? '#6366f1' : 'transparent'
                }}
              >
                {currentBackground === g && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-[inherit]">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {tab === 'color' && (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-2">
              {SOLID_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate({ 
                    background: c, 
                    textColor: LIGHT_COLORS.includes(c) ? '#1e293b' : '#ffffff' 
                  })}
                  className="h-7 rounded-lg border-2 transition-all hover:scale-110 shadow-sm"
                  style={{
                    backgroundColor: c,
                    borderColor: currentBackground === c ? '#6366f1' : 'rgba(0,0,0,0.05)'
                  }}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
               <input 
                  type="color" 
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="h-8 w-10 p-0.5 rounded cursor-pointer bg-white border border-slate-200"
               />
               <button 
                  onClick={() => onUpdate({ background: customColor, textColor: '#ffffff' })}
                  className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
               >
                  Áp dụng
               </button>
            </div>
          </div>
        )}

        {tab === 'link' && (
          <div className="space-y-3">
            <div className="relative">
              <LinkIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Dán link ảnh tại đây..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 transition-all outline-none"
              />
            </div>
            <button
              onClick={() => inputUrl && onUpdate({ background: inputUrl, textColor: '#ffffff' })}
              disabled={!inputUrl}
              className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all disabled:cursor-not-allowed border-b-2 border-slate-700 active:border-b-0 active:translate-y-0.5"
            >
              Áp dụng hình nền
            </button>
          </div>
        )}

        {/* Text Color Toggle */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Màu chữ</span>
           <div className="flex p-0.5 bg-slate-100 rounded-lg">
              <button 
                onClick={() => onUpdate({ textColor: '#ffffff' })}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${currentTextColor === '#ffffff' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
              >
                Sáng
              </button>
              <button 
                onClick={() => onUpdate({ textColor: '#1e293b' })}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${currentTextColor === '#1e293b' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
              >
                Tối
              </button>
           </div>
        </div>

        {/* Remove Background */}
        <button
          onClick={() => onUpdate({ background: undefined, textColor: '#1e293b' })}
          className="w-full py-2.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-all"
        >
          Xóa nền
        </button>
      </div>
    </div>
  );
};
