import { describe, expect, test } from "vitest";
import {
  deriveAutoDraft,
  deriveDrafted,
  deriveInQueue,
  derivePilot,
  deriveStarred,
  deriveVacancyStatus,
} from "./deriveVacancyStatus";
import type { VacancyActionRow } from "./types";

function row(overrides: Partial<VacancyActionRow>): VacancyActionRow {
  return {
    id: 1,
    vacancyId: 1,
    action: "applied",
    ignoreReason: null,
    appliedOn: null,
    outcomeOn: null,
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
        ignoreReason: "interest",
        appliedOn: null,
        createdAt: "2026-10-05T20:00:00.000Z", // 2026-10-06 in KL
      }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "ignored",
      reason: "interest",
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

  test("throws if the latest applied row has no appliedOn (a corrupt/impossible row)", () => {
    const rows = [row({ id: 1, action: "applied", appliedOn: null })];
    expect(() => deriveVacancyStatus(rows)).toThrow(/appliedOn/i);
  });

  test("applied -> success carries the applied date recovered from the preceding applied row, plus outcomeOn", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 2, action: "success", outcomeOn: "2026-10-05" }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "success",
      appliedOn: "2026-10-01",
      outcomeOn: "2026-10-05",
    });
  });

  test("applied -> success -> rejected recovers the original applied date across two outcome hops", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 2, action: "success", outcomeOn: "2026-10-05" }),
      row({ id: 3, action: "rejected", outcomeOn: "2026-10-08" }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "rejected",
      appliedOn: "2026-10-01",
      outcomeOn: "2026-10-08",
    });
  });

  test("throws if a success/rejected row has no preceding applied row (corrupt/impossible history)", () => {
    const rows = [row({ id: 1, action: "success", outcomeOn: "2026-10-05" })];
    expect(() => deriveVacancyStatus(rows)).toThrow(/preceding applied row/i);
  });

  test("throws if the latest success/rejected row has no outcomeOn (a corrupt/impossible row)", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 2, action: "success", outcomeOn: null }),
    ];
    expect(() => deriveVacancyStatus(rows)).toThrow(/outcomeOn/i);
  });

  test("a star row interleaved in the history is invisible to status derivation", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 2, action: "starred" }),
      row({ id: 3, action: "success", outcomeOn: "2026-10-05" }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "success",
      appliedOn: "2026-10-01",
      outcomeOn: "2026-10-05",
    });
  });
});

describe("deriveStarred", () => {
  test("no rows means not starred", () => {
    expect(deriveStarred([])).toBe(false);
  });

  test("a single starred row is starred", () => {
    expect(deriveStarred([row({ id: 1, action: "starred" })])).toBe(true);
  });

  test("a single unstarred row is not starred", () => {
    expect(deriveStarred([row({ id: 1, action: "unstarred" })])).toBe(false);
  });

  test("latest star row (by id) wins, regardless of array order", () => {
    const rows = [
      row({ id: 3, action: "unstarred" }),
      row({ id: 1, action: "starred" }),
    ];
    expect(deriveStarred(rows)).toBe(false);
  });

  test("a reset row never clears a star — status rows are invisible to star derivation", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 2, action: "starred" }),
      row({ id: 3, action: "reset" }),
    ];
    expect(deriveStarred(rows)).toBe(true);
    expect(deriveVacancyStatus(rows)).toEqual({ status: "todo" });
  });

  test("an unstarred row after a rejected row keeps status rejected — star rows are invisible to status derivation", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 2, action: "starred" }),
      row({ id: 3, action: "rejected", outcomeOn: "2026-10-05" }),
      row({ id: 4, action: "unstarred" }),
    ];
    expect(deriveStarred(rows)).toBe(false);
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "rejected",
      appliedOn: "2026-10-01",
      outcomeOn: "2026-10-05",
    });
  });
});

describe("deriveAutoDraft", () => {
  test("false with no rows, true when latest family row is automated_draft", () => {
    expect(deriveAutoDraft([])).toBe(false);
    expect(deriveAutoDraft([row({ id: 1, action: "automated_draft" })])).toBe(true);
  });

  test("cleared then re-marked sequences follow the latest row", () => {
    const cleared = [row({ id: 1, action: "automated_draft" }), row({ id: 2, action: "automated_draft_cleared" })];
    expect(deriveAutoDraft(cleared)).toBe(false);
    expect(deriveAutoDraft([...cleared, row({ id: 3, action: "automated_draft" })])).toBe(true);
  });

  test("ignores automated_draft_done and unrelated rows", () => {
    const rows = [row({ id: 1, action: "automated_draft" }), row({ id: 2, action: "automated_draft_done" }), row({ id: 3, action: "starred" })];
    expect(deriveAutoDraft(rows)).toBe(true);
  });
});

describe("derivePilot", () => {
  test("follows the latest pilot/pilot_cleared row", () => {
    expect(derivePilot([])).toBe(false);
    const rows = [row({ id: 1, action: "pilot" }), row({ id: 2, action: "pilot_cleared" })];
    expect(derivePilot(rows)).toBe(false);
    expect(derivePilot([...rows, row({ id: 3, action: "pilot" })])).toBe(true);
  });
});

describe("deriveDrafted", () => {
  test("true when any automated_draft_done row exists", () => {
    expect(deriveDrafted([])).toBe(false);
    expect(deriveDrafted([row({ id: 1, action: "automated_draft" })])).toBe(false);
    expect(deriveDrafted([row({ id: 1, action: "automated_draft_done" }), row({ id: 2, action: "automated_draft_cleared" })])).toBe(true);
  });
});

describe("deriveInQueue", () => {
  test("marked, not drafted, not applied is queued", () => {
    expect(deriveInQueue([row({ id: 1, action: "automated_draft" })])).toBe(true);
  });

  test("cleared is not queued; re-marked is queued", () => {
    const rows = [row({ id: 1, action: "automated_draft" }), row({ id: 2, action: "automated_draft_cleared" })];
    expect(deriveInQueue(rows)).toBe(false);
    expect(deriveInQueue([...rows, row({ id: 3, action: "automated_draft" })])).toBe(true);
  });

  test("a done row before the latest automated_draft excludes the vacancy", () => {
    const rows = [row({ id: 1, action: "automated_draft_done" }), row({ id: 2, action: "automated_draft" })];
    expect(deriveInQueue(rows)).toBe(false);
  });

  test("a done row after the latest automated_draft excludes the vacancy", () => {
    const rows = [row({ id: 1, action: "automated_draft" }), row({ id: 2, action: "automated_draft_done" })];
    expect(deriveInQueue(rows)).toBe(false);
  });

  test("applied vacancy is excluded", () => {
    const rows = [row({ id: 1, action: "automated_draft" }), row({ id: 2, action: "applied", appliedOn: "2026-10-05" })];
    expect(deriveInQueue(rows)).toBe(false);
  });

  test("success, rejected, ignored and reset-to-todo vacancies stay queued", () => {
    const applied = row({ id: 2, action: "applied", appliedOn: "2026-10-05" });
    const draft = row({ id: 1, action: "automated_draft" });
    expect(deriveInQueue([draft, applied, row({ id: 3, action: "success", outcomeOn: "2026-10-06" })])).toBe(true);
    expect(
      deriveInQueue([draft, applied, row({ id: 3, action: "success", outcomeOn: "2026-10-06" }), row({ id: 4, action: "rejected", outcomeOn: "2026-10-07" })])
    ).toBe(true);
    expect(deriveInQueue([draft, row({ id: 2, action: "ignored" })])).toBe(true);
    expect(deriveInQueue([draft, applied, row({ id: 3, action: "reset" })])).toBe(true);
  });
});
