import type { ParseWarning } from "@/lib/parsers/linkedin";
import type { SyncRunDetail } from "./syncRunRecord";

export function toSyncWarnings(
  messageId: string,
  warnings: ParseWarning[]
): SyncRunDetail[] {
  return warnings.map((warning) => ({
    messageId,
    jobId: warning.jobId,
    reason: warning.reason,
  }));
}
