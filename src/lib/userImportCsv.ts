/** Parse CSV đơn giản (hỗ trợ dấu ngoặc kép RFC-style cơ bản). */
export function parseCsvToMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/^\uFEFF/, '');
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, keyof UserImportRow> = {
  email: 'email',
  displayname: 'displayName',
  display_name: 'displayName',
  ten_hien_thi: 'displayName',
  name: 'displayName',
  ho_ten: 'displayName',
  roleid: 'roleId',
  role_id: 'roleId',
  role: 'roleName',
  rolename: 'roleName',
  role_name: 'roleName',
  vai_tro: 'roleName',
  departmentid: 'departmentId',
  department_id: 'departmentId',
  department: 'departmentName',
  departmentname: 'departmentName',
  department_name: 'departmentName',
  phong_ban: 'departmentName',
};

export type UserImportRow = {
  email?: string;
  displayName?: string;
  roleId?: string;
  roleName?: string;
  departmentId?: string;
  departmentName?: string;
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');
}

/**
 * Chuyển ma trận CSV (dòng đầu là header) thành payload gửi API.
 */
export function matrixToUserImportRows(matrix: string[][]): { rows: UserImportRow[]; errors: string[] } {
  const errors: string[] = [];
  if (matrix.length < 2) {
    errors.push('File cần có ít nhất một dòng tiêu đề và một dòng dữ liệu.');
    return { rows: [], errors };
  }
  const headerCells = matrix[0].map((h) => normalizeHeader(h));
  const keys: (keyof UserImportRow | null)[] = headerCells.map((h) => HEADER_ALIASES[h] ?? null);
  if (!keys.includes('email')) {
    errors.push('Thiếu cột email (hoặc tên tương đương).');
  }
  if (!keys.includes('displayName')) {
    errors.push('Thiếu cột tên hiển thị (displayName, display_name, ten_hien_thi...).');
  }
  if (!keys.some((k) => k === 'roleId' || k === 'roleName')) {
    errors.push('Thiếu cột vai trò (roleId hoặc role / roleName / vai_tro).');
  }
  if (errors.length) return { rows: [], errors };

  const rows: UserImportRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const obj: UserImportRow = {};
    keys.forEach((key, colIdx) => {
      if (!key) return;
      const raw = cells[colIdx] !== undefined ? String(cells[colIdx]).trim() : '';
      if (!raw) return;
      obj[key] = raw;
    });
    if (Object.keys(obj).length) rows.push(obj);
  }
  return { rows, errors: [] };
}

/**
 * File mẫu chi tiết (đồng bộ với public/mau-import-nguoi-dung-chi-tiet.csv).
 * Cột: email (bắt buộc), displayName (bắt buộc), roleName hoặc roleId (bắt buộc), departmentName hoặc departmentId (tuỳ chọn, để trống = không gán phòng ban).
 * roleName phải khớp tên trong hệ thống: ADMIN OWNER LEAD EMPLOYEE FREELANCER CLIENT (và các role khác nếu có).
 * departmentName phải khớp tên phòng ban đã tạo trong PMS; nếu sai tên, dòng đó báo lỗi khi import.
 */
export const USER_IMPORT_CSV_TEMPLATE = `email,displayName,roleName,departmentName
nv.an@congty.com,Nguyễn Văn An,EMPLOYEE,Phòng Kỹ thuật
tran.bich@congty.com,Trần Thị Bích,LEAD,Phòng Kỹ thuật
le.hoang@congty.com,Lê Hoàng Dũng,EMPLOYEE,
hop.dong@partner.vn,Nguyễn Hợp Đồng,FREELANCER,
dai.dien@khachhang.vn,Đại diện Công ty ABC,CLIENT,
pham.owner@congty.com,Phạm Minh Owner,OWNER,
pham.dung@congty.com,"Phạm Thị Dung (Bộ phận CNTT)",EMPLOYEE,"Phòng Công nghệ thông tin"
intern.moi@congty.com,Thực tập sinh Hoàng Mai,EMPLOYEE,
lead.khac@congty.com,Hoàng Văn Trưởng nhóm,LEAD,
client2@duan.vn,Chị Lan Đầu mối dự án,CLIENT,
employee.hn@congty.com,Nguyễn Hà Nội Chi nhánh,EMPLOYEE,Phòng Kinh doanh
freelancer.design@mail.com,Designer Phạm Linh,FREELANCER,
`;
