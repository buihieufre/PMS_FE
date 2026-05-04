import { clsx } from 'clsx';
import type { CSSProperties } from 'react';
import { getBoardBackgroundStyle } from '@/lib/boardBackgroundStyle';
import { getFaviconMarkSvgDocument } from '@/lib/faviconMarkSvg';

/**
 * Nền mặc định (chưa mở bảng / chưa có `project.background`).
 * Đồng bộ với `<rect fill>` đầu tiên trong `public/favicon.svg` nếu bạn đổi màu này.
 */
export const APP_LOGO_DEFAULT_BG = '#0f172a';

/** Giữ tương thích import cũ (asset /favicon.svg tự mang màu). */
export const APP_LOGO_FILL = '#0f172a';

/** Query để bust cache favicon; tăng khi đổi `public/favicon.svg`. */
export const APP_FAVICON_HREF = '/favicon.svg?v=svgo-1';

export const APP_LOGO_SRC = APP_FAVICON_HREF;

/** Logo không nền (glyph từ `src/lib/faviconMarkSvg.ts`) — data URL để khỏi fetch file riêng. */
export const APP_LOGO_MARK_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(getFaviconMarkSvgDocument())}`;

type AppLogoProps = {
  boardBackground: string | null;
  className?: string;
  size?: number;
  /** @deprecated Không còn áp dụng khi dùng favicon.svg; giữ prop để không vỡ call site. */
  fill?: string;
};

/**
 * Logo ứng dụng: glyph SVG inline (`faviconMarkSvg.ts`), nền ô = nền bảng (màu / gradient / ảnh).
 */
export function AppLogo({ boardBackground, className, size = 36 }: AppLogoProps) {
  const v = boardBackground?.trim() ?? '';
  let surfaceStyle: CSSProperties;

  if (!v) {
    surfaceStyle = { backgroundColor: APP_LOGO_DEFAULT_BG };
  } else {
    surfaceStyle = getBoardBackgroundStyle(v);
  }

  const s = size;

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5',
        className
      )}
      style={{ width: s, height: s, ...surfaceStyle }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={APP_LOGO_MARK_DATA_URL}
        alt=""
        width={Math.round(s * 0.72)}
        height={Math.round(s * 0.72)}
        className="pointer-events-none max-h-[72%] max-w-[72%] select-none object-contain"
        draggable={false}
      />
    </span>
  );
}
