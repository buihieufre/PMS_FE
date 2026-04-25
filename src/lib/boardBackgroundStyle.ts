import type { CSSProperties } from 'react';

/**
 * Nền từ DB có thể là: gradient, #hex, rgb(), hoặc URL (http(s), //, /uploads/...)
 * Không dùng shorthand `background: url() center/cover` — tách thành backgroundImage + size.
 */
/** Tương đối sáng (chữ cần tối lên) */
export function isLightColorHex(hex: string): boolean {
  const m = hex.replace('#', '');
  if (m.length !== 6) return true;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

export function isCssColorOrGradient(value: string): boolean {
  const v = value.trim();
  if (
    v.startsWith('linear-gradient') ||
    v.startsWith('radial-gradient') ||
    v.startsWith('#') ||
    v.startsWith('rgb') ||
    v.startsWith('hsl')
  ) {
    return true;
  }
  return false;
}

/** SPLIT: chỉ còn bìa dải; FULL cũ trong DB được chuẩn hoá thành SPLIT. */
export type TaskCoverMode = 'SPLIT' | 'FULL';

/**
 * Bìa ảnh/màu luôn là dải trên cùng + thân trắng. Giá trị FULL (legacy) coi như SPLIT.
 */
export function getEffectiveCoverMode(
  _background: string | null | undefined,
  _coverMode: TaskCoverMode | null | undefined
): 'SPLIT' {
  return 'SPLIT';
}

/** Dải màu / thanh bìa trên cùng (kích thước SPLIT cho màu) */
export function getCoverStripStyle(background: string): CSSProperties {
  const v = String(background).trim();
  if (isCssColorOrGradient(v)) {
    return { background: v };
  }
  return {
    backgroundImage: `url(${v})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

/** Bìa dạng ảnh URL (Trello) — tách thân thẻ nền trắng + ảnh trên */
export function isTaskCoverImageUrl(background: string | null | undefined): boolean {
  if (!background || !String(background).trim()) return false;
  const v = String(background).trim();
  if (isCssColorOrGradient(v)) return false;
  return true;
}

export function getBoardBackgroundStyle(value: string | null | undefined): CSSProperties {
  if (!value || !String(value).trim()) return {};
  const v = String(value).trim();
  if (isCssColorOrGradient(v)) {
    return { background: v };
  }
  return {
    backgroundImage: `url(${v})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

/**
 * Nền thẻ công việc (cùng quy ước; thẻ cần màu nền tường minh, không "inherit" lung tung)
 */
export function getTaskCardSurfaceStyle(
  background: string | null | undefined
): CSSProperties {
  if (!background || !String(background).trim()) {
    return { backgroundColor: '#ffffff' };
  }
  const v = String(background).trim();
  if (isCssColorOrGradient(v)) {
    return { background: v };
  }
  return {
    backgroundImage: `url(${v})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

const TITLE_ON_DARK_BG = '#f8fafc';
const TITLE_ON_LIGHT_BG = '#0f172a';

function srgbChannelToLinear(x: number): number {
  const c = x / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Độ sáng tương đối WCAG 0–1 */
export function relativeLuminanceFromRgb(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b)
  );
}

/** Phân tích #RGB, #RRGGBB, rgb(), rgba() */
export function parseColorToRgb(input: string): { r: number; g: number; b: number } | null {
  const t = input.trim();
  if (t.startsWith('#') && t.length === 4) {
    return {
      r: parseInt(t[1] + t[1], 16),
      g: parseInt(t[2] + t[2], 16),
      b: parseInt(t[3] + t[3], 16),
    };
  }
  if (t.startsWith('#') && t.length === 7) {
    return {
      r: parseInt(t.slice(1, 3), 16),
      g: parseInt(t.slice(3, 5), 16),
      b: parseInt(t.slice(5, 7), 16),
    };
  }
  const m = t.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  return null;
}

/** Độ sáng chữ từ chuỗi màu CSS; null nếu không parse được */
export function colorStringLuminance(s: string): number | null {
  const p = parseColorToRgb(s);
  if (!p) return null;
  return relativeLuminanceFromRgb(p.r, p.g, p.b);
}

/** Ước lượng độ sáng nền (hex, rgb, hoặc trung bình các # trong gradient) */
export function estimateBackgroundLuminance(background: string | null | undefined): number | null {
  if (!background || !String(background).trim()) return null;
  const v = String(background).trim();
  if (isTaskCoverImageUrl(v)) return null;
  if (v.startsWith('linear-gradient') || v.startsWith('radial-gradient')) {
    const hexes = v.match(/#[0-9a-fA-F]{3,6}/g) || [];
    if (hexes.length === 0) return null;
    const ls = hexes
      .map((h) => colorStringLuminance(h))
      .filter((n): n is number => n != null);
    if (ls.length === 0) return null;
    return ls.reduce((a, b) => a + b, 0) / ls.length;
  }
  if (v.startsWith('#') || v.startsWith('rgb')) {
    return colorStringLuminance(v);
  }
  return null;
}

/**
 * Màu tiêu đề thẻ trên board: luôn tách biệt rõ với nền (trắng / màu / ảnh).
 */
export function getCardListTitleColor(
  textColor: string | null | undefined,
  context: { surface: 'white' | 'colored' | 'imageFull' | 'plain'; backgroundValue?: string | null }
): string {
  const t = textColor?.trim() || null;

  if (context.surface === 'plain') {
    if (!t) return TITLE_ON_LIGHT_BG;
    const Lt = colorStringLuminance(t);
    if (Lt != null && Lt > 0.52) return TITLE_ON_LIGHT_BG;
    return t;
  }

  if (context.surface === 'white') {
    if (!t) return TITLE_ON_LIGHT_BG;
    const Lt = colorStringLuminance(t);
    if (Lt == null) return t;
    if (Lt > 0.5) return TITLE_ON_LIGHT_BG;
    return t;
  }

  if (context.surface === 'imageFull') {
    if (!t) return TITLE_ON_DARK_BG;
    const Lt = colorStringLuminance(t);
    if (Lt == null) return TITLE_ON_DARK_BG;
    if (Lt < 0.4) return t;
    return TITLE_ON_DARK_BG;
  }

  if (context.surface === 'colored') {
    const Lbg = estimateBackgroundLuminance(context.backgroundValue);

    if (Lbg == null) {
      if (!t) return TITLE_ON_DARK_BG;
      const Lt = colorStringLuminance(t);
      if (Lt == null) return t;
      if (Lt < 0.25 || Lt > 0.78) return t;
      return Lt > 0.52 ? TITLE_ON_LIGHT_BG : TITLE_ON_DARK_BG;
    }

    if (!t) {
      return Lbg > 0.45 ? TITLE_ON_LIGHT_BG : TITLE_ON_DARK_BG;
    }
    const Lt = colorStringLuminance(t);
    if (Lt == null) {
      return Lbg > 0.45 ? TITLE_ON_LIGHT_BG : TITLE_ON_DARK_BG;
    }
    if (Lbg > 0.48 && Lt > 0.45) return TITLE_ON_LIGHT_BG;
    if (Lbg <= 0.48 && Lt < 0.55) return TITLE_ON_DARK_BG;
    return t;
  }

  return TITLE_ON_LIGHT_BG;
}

export function getTaskTitleColor(
  textColor: string | null | undefined,
  hasCustomBackground: boolean
): string {
  return getCardListTitleColor(textColor, { surface: hasCustomBackground ? 'colored' : 'plain' });
}

export function getTaskMetaStyle(
  textColor: string | null | undefined,
  hasCustomBackground: boolean
): { color: string; borderTopColor: string } {
  const base = textColor;
  if (base) {
    let hex = base;
    if (base.length === 4 && base.startsWith('#')) {
      hex = `#${base[1]}${base[1]}${base[2]}${base[2]}${base[3]}${base[3]}`;
    }
    const isHex6 = base.startsWith('#') && (base.length === 7 || base.length === 4);
    const lightText = isHex6 && isLightColorHex(hex);
    return {
      color: base,
      borderTopColor: lightText ? 'rgba(255,255,255,0.22)' : 'rgba(15, 23, 42, 0.1)',
    };
  }
  if (hasCustomBackground) {
    return { color: 'rgba(248, 250, 252, 0.9)', borderTopColor: 'rgba(255,255,255,0.2)' };
  }
  return { color: '#64748b', borderTopColor: 'rgb(241 245 249)' };
}
