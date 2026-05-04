import { isCssColorOrGradient } from '@/lib/boardBackgroundStyle';
import { APP_LOGO_DEFAULT_BG } from '@/components/Brand/AppLogo';
import { FAVICON_MARK_SVG_FRAGMENT } from '@/lib/faviconMarkSvg';

const FAVICON_VIEW = 32;
const CORNER_R = 7;
const LOGO_PAD = 3;
const MARK_SCALE = (FAVICON_VIEW - LOGO_PAD * 2) / 600;

/** URL tuyệt đối cho ảnh nền bảng (ảnh / đường dẫn tương đối). */
export function resolveBoardAssetUrl(href: string): string {
  const v = href.trim();
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (typeof window === 'undefined') {
    return v.startsWith('/') ? v : `/${v}`;
  }
  if (v.startsWith('//')) return `${window.location.protocol}${v}`;
  if (v.startsWith('/')) return `${window.location.origin}${v}`;
  return `${window.location.origin}/${v}`;
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseCssLinearGradient(css: string): { angleDeg: number; stops: { offset: number; color: string }[] } | null {
  const t = css.trim();
  if (!t.toLowerCase().startsWith('linear-gradient')) return null;
  const innerMatch = t.match(/^linear-gradient\s*\(([\s\S]*)\)\s*$/i);
  if (!innerMatch) return null;
  let rest = innerMatch[1].trim();
  let angleDeg = 180;
  const ang = rest.match(/^(-?\d+(?:\.\d+)?)deg\s*,\s*/i);
  if (ang) {
    angleDeg = parseFloat(ang[1]);
    rest = rest.slice(ang[0].length).trim();
  }
  const rawParts = splitTopLevelCommas(rest);
  const stops: { offset: number; color: string }[] = [];
  for (const p of rawParts) {
    const pt = p.trim();
    const withPct = pt.match(/^(.+?)\s+(\d+(?:\.\d+)?)%\s*$/);
    if (withPct) {
      stops.push({ color: withPct[1].trim(), offset: parseFloat(withPct[2]) / 100 });
    } else if (pt) {
      stops.push({ color: pt, offset: stops.length === 0 ? 0 : 1 });
    }
  }
  if (stops.length < 2) return null;
  return { angleDeg, stops };
}

function linearGradientEndpoints(angleDeg: number, w: number, h: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const L = Math.sqrt(w * w + h * h) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return {
    x0: cx - Math.sin(rad) * L,
    y0: cy + Math.cos(rad) * L,
    x1: cx + Math.sin(rad) * L,
    y1: cy - Math.cos(rad) * L,
  };
}

function escapeXmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rectFill(w: number, h: number, fill: string): string {
  return `<rect width="${w}" height="${h}" fill="${escapeXmlAttr(fill)}"/>`;
}

async function fetchBoardImageDataUrl(boardBg: string): Promise<string | null> {
  const url = resolveBoardAssetUrl(boardBg.trim());
  try {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildCssBackgroundSvg(v: string): { extraDefs: string; bgInner: string } {
  if (v.toLowerCase().includes('javascript:') || v.includes('</')) {
    return { extraDefs: '', bgInner: rectFill(FAVICON_VIEW, FAVICON_VIEW, APP_LOGO_DEFAULT_BG) };
  }

  const linear = parseCssLinearGradient(v);
  if (linear) {
    const { x0, y0, x1, y1 } = linearGradientEndpoints(linear.angleDeg, FAVICON_VIEW, FAVICON_VIEW);
    const stops = linear.stops
      .map(
        (s) =>
          `<stop offset="${(Math.min(1, Math.max(0, s.offset)) * 100).toFixed(2)}%" stop-color="${escapeXmlAttr(s.color)}"/>`
      )
      .join('');
    return {
      extraDefs: `<linearGradient id="boardBg" gradientUnits="userSpaceOnUse" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}">${stops}</linearGradient>`,
      bgInner: `<rect width="${FAVICON_VIEW}" height="${FAVICON_VIEW}" fill="url(#boardBg)"/>`,
    };
  }

  if (v.toLowerCase().trim().startsWith('radial-gradient')) {
    const hexes = v.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    if (hexes.length >= 2) {
      const c0 = hexes[0]!;
      const c1 = hexes[hexes.length - 1]!;
      const cx = FAVICON_VIEW / 2;
      const cy = FAVICON_VIEW / 2;
      const r = (Math.sqrt(2) * FAVICON_VIEW) / 2;
      return {
        extraDefs: `<radialGradient id="boardBg" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0%" stop-color="${escapeXmlAttr(c0)}"/><stop offset="100%" stop-color="${escapeXmlAttr(c1)}"/></radialGradient>`,
        bgInner: `<rect width="${FAVICON_VIEW}" height="${FAVICON_VIEW}" fill="url(#boardBg)"/>`,
      };
    }
  }

  const safe = v.replace(/[<>&]/g, '').slice(0, 400);
  return { extraDefs: '', bgInner: rectFill(FAVICON_VIEW, FAVICON_VIEW, safe) };
}

/**
 * Favicon tab trên board: SVG thuần (không Canvas / không fetch logo).
 * Nền: rect / linearGradient / radialGradient / ảnh (data URL sau fetch).
 * Glyph logo: `FAVICON_MARK_SVG_FRAGMENT` trong `faviconMarkSvg.ts` — sửa fill trực tiếp trong file đó.
 */
export async function buildAppFaviconDataUrl(boardBackground: string | null | undefined): Promise<string> {
  const v = boardBackground?.trim() ?? '';
  let extraDefs = '';
  let bgInner: string;

  if (!v) {
    bgInner = rectFill(FAVICON_VIEW, FAVICON_VIEW, APP_LOGO_DEFAULT_BG);
  } else if (isCssColorOrGradient(v)) {
    const b = buildCssBackgroundSvg(v);
    extraDefs = b.extraDefs;
    bgInner = b.bgInner;
  } else {
    const dataUrl = await fetchBoardImageDataUrl(v);
    if (dataUrl) {
      bgInner = `<image href="${escapeXmlAttr(dataUrl)}" width="${FAVICON_VIEW}" height="${FAVICON_VIEW}" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
      bgInner = rectFill(FAVICON_VIEW, FAVICON_VIEW, APP_LOGO_DEFAULT_BG);
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FAVICON_VIEW} ${FAVICON_VIEW}">
  <defs>
    <clipPath id="tileClip"><rect width="${FAVICON_VIEW}" height="${FAVICON_VIEW}" rx="${CORNER_R}" ry="${CORNER_R}"/></clipPath>
    ${extraDefs}
  </defs>
  <g clip-path="url(#tileClip)">
    ${bgInner}
    <g transform="translate(${LOGO_PAD},${LOGO_PAD}) scale(${MARK_SCALE})">
      ${FAVICON_MARK_SVG_FRAGMENT}
    </g>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
