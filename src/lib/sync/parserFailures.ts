import type { ParseFailure } from "@/lib/parsers/linkedin";

export interface ParserFailure {
  messageId: string;
  reason: string;
}

export function toParserFailures(
  messageId: string,
  failures: ParseFailure[]
): ParserFailure[] {
  return failures.map((failure) => ({ messageId, reason: failure.reason }));
}
