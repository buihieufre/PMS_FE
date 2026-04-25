/**
 * Mirrors backend `taskService.getTasks` filters so live socket updates
 * add/remove the right cards for the current user (e.g. when assigned in realtime).
 */
export function shouldShowTaskOnBoard(
  task: { assignees?: { id: string }[]; departmentId?: string | null; archivedAt?: string | null },
  userId: string | undefined,
  member: { projectRole?: string; departmentId?: string | null; userId?: string } | undefined
): boolean {
  if (!userId || !task) return false;
  if (task.archivedAt) return false;
  const role = member?.projectRole;
  const assigneeIds = (task.assignees || []).map((a: { id?: string }) => a?.id).filter(Boolean) as string[];

  if (role === 'FREELANCER') {
    return assigneeIds.includes(userId);
  }
  if (role === 'EMPLOYEE' || role === 'TEAM_LEAD') {
    if (member?.departmentId && task.departmentId) {
      return String(task.departmentId) === String(member.departmentId);
    }
    return assigneeIds.includes(userId);
  }
  // PROJECT_OWNER, CLIENT, and other roles: full project (same as getTasks default { projectId })
  return true;
}
