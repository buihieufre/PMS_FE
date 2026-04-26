import { useRef, useState } from 'react';
import { X, Loader2, Upload, FileDown, FileSpreadsheet, AlertCircle } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import {
  parseCsvToMatrix,
  matrixToUserImportRows,
  USER_IMPORT_CSV_TEMPLATE,
  type UserImportRow,
} from '@/lib/userImportCsv';

const ERROR_LABELS: Record<string, string> = {
  MISSING_REQUIRED_FIELDS: 'Thiếu email hoặc tên hiển thị',
  INVALID_ROLE: 'Vai trò không hợp lệ (dùng đúng tên vai trò trong hệ thống hoặc roleId)',
  USER_EXISTS: 'Email đã tồn tại',
  INVALID_EMAIL: 'Email không đúng định dạng — đã bỏ qua, không tạo tài khoản',
  INVITATION_EMAIL_FAILED:
    'Không gửi được email mời (hộp thư không nhận / lỗi SMTP) — đã bỏ qua, không tạo tài khoản',
  UNKNOWN_ERROR: 'Lỗi không xác định',
};

interface ImportUsersCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportUsersCsvModal({ isOpen, onClose, onSuccess }: ImportUsersCsvModalProps) {
  const [parsedRows, setParsedRows] = useState<UserImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExcelLoading, setIsExcelLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: number;
    failed: { rowIndex: number; email: string; error: string }[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setParsedRows([]);
    setParseErrors([]);
    setFileName('');
    setLastResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const downloadTemplate = () => {
    const blob = new Blob([`\uFEFF${USER_IMPORT_CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau-import-nguoi-dung-chi-tiet.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = async () => {
    try {
      setIsExcelLoading(true);
      const { downloadUserImportWorkbook } = await import('@/lib/buildUserImportWorkbook');
      await downloadUserImportWorkbook();
      toast.success('Đã tải file Excel mẫu (1 sheet)');
    } catch {
      toast.error('Không tạo được file Excel');
    } finally {
      setIsExcelLoading(false);
    }
  };

  const handleFile = async (file: File | null) => {
    setLastResult(null);
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const matrix = parseCsvToMatrix(text);
    const { rows, errors } = matrixToUserImportRows(matrix);
    setParseErrors(errors);
    setParsedRows(rows);
    if (errors.length) {
      toast.error('File CSV không đúng định dạng cột');
    } else if (rows.length === 0) {
      toast.error('Không có dòng dữ liệu hợp lệ');
    } else {
      toast.success(`Đã đọc ${rows.length} dòng`);
    }
  };

  const handleSubmit = async () => {
    if (parsedRows.length === 0 || parseErrors.length) {
      toast.error('Vui lòng chọn file CSV hợp lệ');
      return;
    }
    setIsSubmitting(true);
    setLastResult(null);
    try {
      const res = await axiosInstance.post('/users/import', { users: parsedRows });
      const { success = [], failed = [] } = res.data || {};
      setLastResult({
        success: success.length,
        failed: failed.map((f: { rowIndex: number; email: string; error: string }) => ({
          rowIndex: f.rowIndex,
          email: f.email,
          error: ERROR_LABELS[f.error] || f.error,
        })),
      });
      if (success.length) {
        toast.success(`Đã gửi lời mời: ${success.length} người dùng`);
        onSuccess();
      }
      if (failed.length) {
        toast.error(`${failed.length} dòng thất bại — xem chi tiết bên dưới`);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Import thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Import người dùng từ CSV</h2>
          <button type="button" onClick={handleClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              Mỗi dòng tạo một lời mời (email kích hoạt), giống &quot;Thêm người dùng&quot;.{' '}
              <strong>Cột bắt buộc:</strong> email, displayName (hoặc <code className="text-xs bg-slate-100 px-1 rounded">ten_hien_thi</code>,{' '}
              <code className="text-xs bg-slate-100 px-1 rounded">ho_ten</code>), và <strong>roleName</strong> hoặc{' '}
              <strong>roleId</strong> (<code className="text-xs bg-slate-100 px-1 rounded">vai_tro</code>).
            </p>
            <p>
              <strong>Phòng ban (tuỳ chọn):</strong> để trống hoặc dùng <strong>departmentName</strong> /{' '}
              <code className="text-xs bg-slate-100 px-1 rounded">phong_ban</code> / <strong>departmentId</strong> — tên phòng ban phải{' '}
              <span className="font-medium text-slate-800">trùng khớp</span> dữ liệu đã có trong PMS.
            </p>
            <p className="text-xs text-slate-500">
              File mẫu gồm nhiều dòng ví dụ (EMPLOYEE, LEAD, OWNER, FREELANCER, CLIENT). Có thể tải CSV hoặc Excel (một sheet, cùng nội dung); khi
              import vẫn dùng file <strong>.csv</strong>.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={() => void downloadExcelTemplate()}
              disabled={isExcelLoading}
              className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-60"
            >
              {isExcelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Tải Excel mẫu
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <FileDown className="h-4 w-4" />
              Tải CSV mẫu (UTF-8)
            </button>
            <a
              href="/mau-import-nguoi-dung-chi-tiet.csv"
              download="mau-import-nguoi-dung-chi-tiet.csv"
              className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-2"
            >
              Mở CSV trong public
            </a>
          </div>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-5 w-5" />
              {fileName ? fileName : 'Chọn file .csv'}
            </button>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-sm text-rose-800 space-y-1">
              {parseErrors.map((err, i) => (
                <div key={i} className="flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {parsedRows.length > 0 && parseErrors.length === 0 && (
            <p className="text-sm text-slate-600">
              Sẵn sàng import: <strong>{parsedRows.length}</strong> dòng
            </p>
          )}

          {lastResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
              <p>
                Thành công: <strong className="text-emerald-700">{lastResult.success}</strong> — Lỗi:{' '}
                <strong className="text-rose-700">{lastResult.failed.length}</strong>
              </p>
              {lastResult.failed.length > 0 && (
                <ul className="max-h-36 overflow-y-auto text-xs text-slate-700 space-y-1 list-disc pl-4">
                  {lastResult.failed.map((f, i) => (
                    <li key={i}>
                      Dòng {f.rowIndex} ({f.email || '—'}): {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={isSubmitting || parsedRows.length === 0 || parseErrors.length > 0}
            onClick={() => void handleSubmit()}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 border border-transparent rounded-md hover:bg-slate-800 transition-colors flex items-center disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Gửi lời mời
          </button>
        </div>
      </div>
    </div>
  );
}
