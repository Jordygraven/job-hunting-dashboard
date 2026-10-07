import type { SyncRunDetail } from "./syncRunRecord";

export function toSyncRunDetails(
  messageId: string,
  items: { jobId: string | null; reason: string }[]
): SyncRunDetail[] {
  return items.map((item) => ({ messageId, jobId: item.jobId, reason: item.reason }));
}
