export type IgnoreReason = "language" | "location" | "seniority" | "other";

export type VacancyActionRow = {
  id: number;
  vacancyId: number;
  action: "applied" | "ignored" | "reset";
  ignoreReason: IgnoreReason | null;
  appliedOn: string | null;
  createdAt: string;
};

export type VacancyStatus =
  | { status: "todo" }
  | { status: "applied"; appliedOn: string }
  | { status: "ignored"; reason: IgnoreReason | null; date: string };
