/** Trạng thái gán cho cột template — khớp TaskStatus backend. */
export const TEMPLATE_MAP_STATUS_OPTIONS: { id: string; title: string }[] = [
  { id: 'PENDING', title: 'Chờ xử lý' },
  { id: 'IN_PROGRESS', title: 'Đang thực hiện' },
  { id: 'WAITING_FOR_DOCUMENT', title: 'Chờ tài liệu' },
  { id: 'DELAYED', title: 'Tạm hoãn' },
  { id: 'DONE', title: 'Hoàn thành' },
  { id: 'APPROVED', title: 'Đã duyệt' },
  { id: 'REJECTED', title: 'Từ chối' },
];

export const TEMPLATE_COLUMN_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: 'Xám', value: 'bg-slate-100 text-slate-600' },
  { label: 'Xanh dương', value: 'bg-blue-50 text-blue-600' },
  { label: 'Cam', value: 'bg-amber-50 text-amber-600' },
  { label: 'Hồng / Trễ', value: 'bg-rose-50 text-rose-600' },
  { label: 'Xanh lá', value: 'bg-emerald-50 text-emerald-600' },
  { label: 'Chàm', value: 'bg-indigo-50 text-indigo-600' },
  { label: 'Đỏ', value: 'bg-red-50 text-red-700' },
];
