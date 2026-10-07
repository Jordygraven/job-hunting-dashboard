import type { ParseWarning } from "@/lib/parsers/linkedin";
import type { SyncRunDetail } from "./syncRunRecord";
import { toSyncRunDetails } from "./syncRunDetails";

export function toSyncWarnings(
  messageId: string,
  warnings: ParseWarning[]
): SyncRunDetail[] {
  return toSyncRunDetails(messageId, warnings);
}
