import type { ParseFailure } from "@/lib/parsers/linkedin";
import type { SyncRunDetail } from "./syncRunRecord";
import { toSyncRunDetails } from "./syncRunDetails";

export function toParserFailures(
  messageId: string,
  failures: ParseFailure[]
): SyncRunDetail[] {
  return toSyncRunDetails(messageId, failures);
}
