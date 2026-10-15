import type { BoardCheck } from "./types";

const EMPTY_RECHECK_MS = 14 * 24 * 60 * 60 * 1000;

export function isDue(check: BoardCheck | undefined, now: Date): "due" | "not_due" | "dead" {
  if (check?.status === "dead") return "dead";
  if (check?.status === "empty" && now.getTime() - new Date(check.checkedAt).getTime() < EMPTY_RECHECK_MS) {
    return "not_due";
  }
  return "due";
}
