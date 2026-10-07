import type { ParseFailure } from "@/lib/parsers/linkedin";
import type { SyncRunDetail } from "./syncRunRecord";

export function toParserFailures(
  messageId: string,
  failures: ParseFailure[]
): SyncRunDetail[] {
  return failures.map((failure) => ({
    messageId,
    jobId: failure.jobId,
    reason: failure.reason,
  }));
}
