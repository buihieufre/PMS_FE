import { parseCsvToMatrix, USER_IMPORT_CSV_TEMPLATE } from './userImportCsv';

/** Excel một sheet — cùng nội dung với CSV mẫu (để mở bằng Excel / chỉnh sửa rồi lưu CSV nếu cần). */
export async function downloadUserImportWorkbook(): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const dataAoA = parseCsvToMatrix(USER_IMPORT_CSV_TEMPLATE.trim());
  const ws = XLSX.utils.aoa_to_sheet(dataAoA);
  XLSX.utils.book_append_sheet(wb, ws, 'Du_lieu_mau');
  XLSX.writeFile(wb, 'mau-import-nguoi-dung.xlsx');
}
