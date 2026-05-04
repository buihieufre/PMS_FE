import { clsx } from 'clsx';
import type { BoardTemplateListColumn } from '@/lib/boardTemplateOption';

type BoardTemplatePreviewProps = {
  lists: BoardTemplateListColumn[];
  /** Đổi id khi chọn template khác — chạy lại animation */
  templateId: string;
  mode?: 'compact' | 'board';
  className?: string;
};

/**
 * Xem trước mini bộ cột Kanban; khung có keyframe khi đổi lựa chọn (parent đặt key={templateId}).
 */
export function BoardTemplatePreview({
  lists,
  templateId,
  mode = 'compact',
  className,
}: BoardTemplatePreviewProps) {
  const sorted = [...lists].sort((a, b) => a.sortOrder - b.sortOrder);

  if (sorted.length === 0) {
    return (
      <div
        className={clsx(
          'rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-xs text-slate-500',
          className
        )}
      >
        Không có dữ liệu cột cho template này.
      </div>
    );
  }

  if (mode === 'board') {
    return (
      <div
        key={templateId}
        className={clsx(
          'rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm',
          'animate-template-preview-reveal motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none',
          className
        )}
      >
        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Xem trước dạng bảng</p>
        <div className="flex max-w-full gap-3 overflow-x-auto pb-1 custom-scrollbar">
          {sorted.map((col) => (
            <div
              key={`${templateId}-board-${col.sortOrder}-${col.mapsToStatus}`}
              className="flex h-[170px] w-[205px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-200/90 bg-slate-50/95 p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={clsx(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                      col.colorClass || 'bg-slate-100 text-slate-700'
                    )}
                  >
                    0
                  </span>
                  <span className="truncate text-xs font-bold text-slate-800">{col.name}</span>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 bg-slate-50/40 p-2">
                <div className="rounded-xl border border-slate-200 bg-white p-2">
                  <div className="h-2 w-4/5 rounded bg-slate-200/90" />
                  <div className="mt-1.5 h-2 w-full rounded bg-slate-200/70" />
                  <div className="mt-1.5 h-2 w-3/5 rounded bg-slate-200/50" />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2">
                  <div className="h-2 w-2/3 rounded bg-slate-200/80" />
                  <div className="mt-1.5 h-2 w-5/6 rounded bg-slate-200/60" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      key={templateId}
      className={clsx(
        'rounded-2xl border border-amber-200/60 bg-gradient-to-b from-white via-white to-amber-50/40 p-3',
        'shadow-sm animate-template-preview-reveal motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none',
        className
      )}
    >
      <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-amber-900/70">Xem trước cột</p>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-0.5 custom-scrollbar">
        {sorted.map((col) => (
          <div
            key={`${templateId}-${col.sortOrder}-${col.mapsToStatus}`}
            className="flex h-[76px] w-[104px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
          >
            <div
              className={clsx(
                'shrink-0 truncate px-2 py-1.5 text-[10px] font-bold leading-tight',
                col.colorClass || 'bg-slate-100 text-slate-700'
              )}
              title={`${col.name} (${col.mapsToStatus})`}
            >
              {col.name}
            </div>
            <div className="min-h-0 flex-1 space-y-1 bg-gradient-to-b from-slate-50/90 to-slate-100/50 px-1.5 py-1.5">
              <div className="h-1.5 w-full rounded-full bg-slate-200/90" />
              <div className="h-1.5 w-4/5 rounded-full bg-slate-200/60" />
              <div className="h-1.5 w-3/5 rounded-full bg-slate-200/40" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-medium text-slate-500">
        {sorted.length} cột — thứ tự giống khi áp dụng lên bảng
      </p>
    </div>
  );
}
