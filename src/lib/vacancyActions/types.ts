export type IgnoreReason = "language" | "interest" | "seniority" | "other";

export const STATUS_ACTIONS = ["applied", "ignored", "reset", "rejected", "success"] as const;
export const STAR_ACTIONS = ["starred", "unstarred"] as const;

export type VacancyActionRow = {
  id: number;
  vacancyId: number;
  action: (typeof STATUS_ACTIONS)[number] | (typeof STAR_ACTIONS)[number];
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
