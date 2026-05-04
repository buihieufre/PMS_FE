/** Cột trong template (API GET /projects/board-templates). */
export type BoardTemplateListColumn = {
  name: string;
  sortOrder: number;
  colorClass: string | null;
  mapsToStatus: string;
};

export type BoardTemplateOption = {
  id: string;
  name: string;
  lists: BoardTemplateListColumn[];
  isBuiltIn?: boolean;
  description?: string | null;
};

/** Chuẩn hóa payload Prisma từ API. */
export function normalizeBoardTemplateOption(t: {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  description?: string | null;
  lists?: Array<{
    name: string;
    sortOrder?: number;
    colorClass?: string | null;
    mapsToStatus?: string;
  }>;
}): BoardTemplateOption {
  const lists = Array.isArray(t.lists)
    ? [...t.lists]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((l) => ({
          name: l.name,
          sortOrder: l.sortOrder ?? 0,
          colorClass: l.colorClass ?? null,
          mapsToStatus: l.mapsToStatus ?? 'PENDING',
        }))
    : [];
  return {
    id: t.id,
    name: t.name,
    lists,
    isBuiltIn: t.isBuiltIn,
    description: t.description ?? null,
  };
}
