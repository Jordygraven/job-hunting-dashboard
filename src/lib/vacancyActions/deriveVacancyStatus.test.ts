import { describe, expect, test } from "vitest";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import type { VacancyActionRow } from "./types";

function row(overrides: Partial<VacancyActionRow>): VacancyActionRow {
  return {
    id: 1,
    vacancyId: 1,
    action: "applied",
    ignoreReason: null,
    appliedOn: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveVacancyStatus", () => {
  test("no rows means todo", () => {
    expect(deriveVacancyStatus([])).toEqual({ status: "todo" });
  });

  test("a single applied row carries its appliedOn date", () => {
    const rows = [row({ id: 1, action: "applied", appliedOn: "2026-10-05" })];
    expect(deriveVacancyStatus(rows)).toEqual({ status: "applied", appliedOn: "2026-10-05" });
  });

  test("a single ignored row carries its reason and the KL date of created_at", () => {
    const rows = [
      row({
        id: 1,
        action: "ignored",
        ignoreReason: "location",
        appliedOn: null,
        createdAt: "2026-10-05T20:00:00.000Z", // 2026-10-06 in KL
      }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "ignored",
      reason: "location",
      date: "2026-10-06",
    });
  });

  test("an ignored row with no reason carries a null reason", () => {
    const rows = [row({ id: 1, action: "ignored", ignoreReason: null, appliedOn: null })];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "ignored",
      reason: null,
      date: "2026-10-01",
    });
  });

  test("a latest reset row means todo even if earlier rows say otherwise", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 2, action: "reset", appliedOn: null }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({ status: "todo" });
  });

  test("latest is determined by highest id, not by created_at ordering", () => {
    const rows = [
      row({ id: 5, action: "applied", appliedOn: "2026-10-05", createdAt: "2026-10-05T00:00:00.000Z" }),
      // Lower id but a *later* created_at timestamp — id must still win.
      row({ id: 3, action: "reset", appliedOn: null, createdAt: "2026-10-09T00:00:00.000Z" }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({ status: "applied", appliedOn: "2026-10-05" });
  });

  test("rows out of array order are still resolved by highest id", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 3, action: "ignored", ignoreReason: "other", appliedOn: null }),
      row({ id: 2, action: "reset", appliedOn: null }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "ignored",
      reason: "other",
      date: "2026-10-01",
    });
  });
});
