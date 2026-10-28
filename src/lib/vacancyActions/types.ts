export type IgnoreReason = "language" | "interest" | "seniority" | "duplicate" | "other";

export const STATUS_ACTIONS = ["applied", "ignored", "reset", "rejected", "success"] as const;
export const STAR_ACTIONS = ["starred", "unstarred"] as const;
export const DRAFT_ACTIONS = ["automated_draft", "automated_draft_cleared", "automated_draft_done"] as const;
export const PILOT_ACTIONS = ["pilot", "pilot_cleared"] as const;
export const ALL_ACTIONS = [...STATUS_ACTIONS, ...STAR_ACTIONS, ...DRAFT_ACTIONS, ...PILOT_ACTIONS] as const;

export type VacancyActionRow = {
  id: number;
  vacancyId: number;
  action: (typeof ALL_ACTIONS)[number];
  ignoreReason: IgnoreReason | null;
  appliedOn: string | null;
  outcomeOn: string | null;
  createdAt: string;
};

export type VacancyStatus =
  | { status: "todo" }
  | { status: "applied"; appliedOn: string }
  | { status: "ignored"; reason: IgnoreReason | null; date: string }
  | { status: "success"; appliedOn: string; outcomeOn: string }
  | { status: "rejected"; appliedOn: string; outcomeOn: string };
