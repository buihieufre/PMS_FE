/**
 * Mô tả công việc: lưu chuỗi JSON OutputData của Editor.js, hoặc văn bản thuần (dữ liệu cũ).
 */

export function parseTaskDescriptionData(raw: string | null | undefined): { blocks: any[] } {
  if (raw == null || !String(raw).trim()) {
    return { blocks: [] };
  }
  const s = String(raw).trim();
  try {
    const parsed = JSON.parse(s);
    if (parsed && Array.isArray(parsed.blocks)) {
      return parsed;
    }
  } catch {
    // legacy plain text
  }
  return {
    blocks: [
      {
        type: 'paragraph',
        data: { text: s },
      },
    ],
  };
}

function blockHasText(block: any): boolean {
  if (!block) return false;
  const d = block.data;
  if (!d) return false;
  if (typeof d.text === 'string' && d.text.trim()) return true;
  if (block.type === 'header' && typeof d.text === 'string' && d.text.trim()) return true;
  if (block.type === 'list' && Array.isArray(d.items)) {
    for (const item of d.items) {
      if (typeof item === 'string' && item.trim()) return true;
      if (item && typeof item.content === 'string' && item.content.trim()) return true;
    }
  }
  if (block.type === 'checklist' && Array.isArray(d.items)) {
    for (const item of d.items) {
      if (item?.text && String(item.text).trim()) return true;
    }
  }
  if (block.type === 'quote' && typeof d.text === 'string' && d.text.trim()) return true;
  if (block.type === 'code' && typeof d.code === 'string' && d.code.trim()) return true;
  if (block.type === 'table' && d.content) return true;
  if (block.type === 'delimiter') return true;
  return false;
}

export function editorDataHasContent(data: { blocks: any[] } | null | undefined): boolean {
  if (!data?.blocks?.length) return false;
  return data.blocks.some((b) => blockHasText(b));
}

export function taskDescriptionHasContent(raw: string | null | undefined): boolean {
  if (raw == null || !String(raw).trim()) return false;
  const s = String(raw).trim();
  try {
    const parsed = JSON.parse(s);
    if (parsed?.blocks) return editorDataHasContent(parsed);
  } catch {
    // plain
  }
  return true;
}

/**
 * Một dòng xem nhanh (card, danh sách) — bỏ định dạng, giới hạn độ dài.
 */
export function taskDescriptionToPlainText(raw: string | null | undefined, maxLen = 200): string {
  if (raw == null || !String(raw).trim()) return '';
  const s = String(raw).trim();
  let data: { blocks: any[] };
  try {
    const parsed = JSON.parse(s);
    if (parsed?.blocks) data = parsed;
    else {
      return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
    }
  } catch {
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  }
  const parts: string[] = [];
  for (const block of data.blocks || []) {
    const d = block?.data;
    if (!d) continue;
    if (typeof d.text === 'string' && d.text.trim()) parts.push(d.text.trim());
    if (block.type === 'header' && d.text) parts.push(String(d.text).trim());
    if (block.type === 'list' && Array.isArray(d.items)) {
      for (const item of d.items) {
        if (typeof item === 'string' && item.trim()) parts.push(item);
        if (item?.content) parts.push(String(item.content).trim());
      }
    }
    if (block.type === 'checklist' && Array.isArray(d.items)) {
      for (const item of d.items) {
        if (item?.text) parts.push(String(item.text).trim());
      }
    }
    if (block.type === 'quote' && d.text) parts.push(String(d.text).trim());
    if (block.type === 'code' && d.code) parts.push(String(d.code).trim());
  }
  const out = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!out) return '';
  if (out.length <= maxLen) return out;
  return `${out.slice(0, maxLen)}…`;
}
