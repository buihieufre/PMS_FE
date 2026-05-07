/** Khớp ACTIONS trong API (src/config/permissions.js) */
export const PERMISSION_ACTIONS = {
  CREATE_PROJECTS: 'create:projects',
  UPDATE_PROJECTS: 'update:projects',
  DELETE_PROJECTS: 'delete:projects',
} as const;

type UserLike = { id?: string; role?: string; permissions?: string[] } | null;

export type ProjectOwnershipFields = {
  ownerId?: string;
  myProjectRole?: string | null;
};

function permissionOrLegacyOwner(user: NonNullable<UserLike>, perm: string): boolean {
  const role = String(user.role || '').toUpperCase();
  if (role === 'ADMIN') return true;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes(perm);
  }
  if (perm === PERMISSION_ACTIONS.CREATE_PROJECTS || perm === PERMISSION_ACTIONS.UPDATE_PROJECTS) {
    return role === 'OWNER';
  }
  if (perm === PERMISSION_ACTIONS.DELETE_PROJECTS) {
    return role === 'OWNER';
  }
  return false;
}

/**
 * Tạo dự án
 */
export function canCreateProjects(user: UserLike): boolean {
  if (!user) return false;
  return permissionOrLegacyOwner(user, PERMISSION_ACTIONS.CREATE_PROJECTS);
}

/** Sửa thông tin dự án (tên, mô tả, …); chia sẻ khách cũng cần quyền này phía backend */
export function canUpdateProjects(user: UserLike): boolean {
  if (!user) return false;
  return permissionOrLegacyOwner(user, PERMISSION_ACTIONS.UPDATE_PROJECTS);
}

/** Xóa dự án */
export function canDeleteProjects(user: UserLike): boolean {
  if (!user) return false;
  return permissionOrLegacyOwner(user, PERMISSION_ACTIONS.DELETE_PROJECTS);
}

/**
 * ADMIN; hoặc chủ ghi DB; hoặc thành viên vai trò PROJECT_OWNER trong dự án —
 * khớp yêu cầu PATCH/DELETE `/projects/:id` (sau middleware quyền hệ thống).
 */
export function hasProjectOwnershipAccess(user: UserLike, project: ProjectOwnershipFields): boolean {
  if (!user?.id) return false;
  const r = String(user.role || '').toUpperCase();
  if (r === 'ADMIN') return true;
  if (project.ownerId && project.ownerId === user.id) return true;
  return project.myProjectRole === 'PROJECT_OWNER';
}

export function canEditProject(user: UserLike, project: ProjectOwnershipFields): boolean {
  return canUpdateProjects(user) && hasProjectOwnershipAccess(user, project);
}

export function canDeleteProject(user: UserLike, project: ProjectOwnershipFields): boolean {
  return canDeleteProjects(user) && hasProjectOwnershipAccess(user, project);
}

/** Link chia sẻ khách (chỉ xem tiến độ): cập nhật mức dự án — backend dùng update:projects + PROJECT_OWNER */
export function canManageCustomerShareLinks(user: UserLike, project: ProjectOwnershipFields): boolean {
  return canUpdateProjects(user) && hasProjectOwnershipAccess(user, project);
}
