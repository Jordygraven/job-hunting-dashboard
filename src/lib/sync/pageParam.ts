// Invalid or out-of-range input clamps to the nearest valid page (always at least 1).
export function clampPage(raw: string | string[] | undefined, totalPages: number): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = value !== undefined && /^\d+$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(parsed, 1), Math.max(totalPages, 1));
}
