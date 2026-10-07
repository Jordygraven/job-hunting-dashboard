import { beforeEach, describe, expect, test, vi } from "vitest";

let writeVacancyActionMock: any;
let revalidatePathMock: any;
let runSyncMock: any;

vi.mock("@/lib/vacancyActions/writeVacancyAction", () => ({
  writeVacancyAction: (...args: any[]) => writeVacancyActionMock(...args),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: any[]) => revalidatePathMock(...args),
}));
vi.mock("@/lib/sync/runSync", () => ({
  runSync: (...args: any[]) => runSyncMock(...args),
}));

import { apply, editAppliedDate, ignore, runManualSync, undo } from "./actions";

beforeEach(() => {
  writeVacancyActionMock = vi.fn();
  revalidatePathMock = vi.fn();
  runSyncMock = vi.fn();
});

describe("apply", () => {
  test("calls writeVacancyAction with intent apply and revalidates on success", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    const result = await apply(1);
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("does not revalidate on failure", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: false, error: "Already marked as applied." });
    const result = await apply(1);
    expect(result).toEqual({ ok: false, error: "Already marked as applied." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("ignore", () => {
  test("passes the reason through when given", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    await ignore(2, "interest");
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "ignore", vacancyId: 2, reason: "interest" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("omits the reason when not given", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    await ignore(2);
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "ignore", vacancyId: 2, reason: undefined });
  });
});

describe("undo", () => {
  test("calls writeVacancyAction with intent undo and revalidates on success", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    const result = await undo(3);
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "undo", vacancyId: 3 });
    expect(result).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("does not revalidate on failure", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: false, error: "Nothing to undo." });
    const result = await undo(3);
    expect(result).toEqual({ ok: false, error: "Nothing to undo." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("editAppliedDate", () => {
  test("calls writeVacancyAction with intent editAppliedDate and the given date", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    const result = await editAppliedDate(4, "2026-10-01");
    expect(writeVacancyActionMock).toHaveBeenCalledWith({
      intent: "editAppliedDate",
      vacancyId: 4,
      appliedOn: "2026-10-01",
    });
    expect(result).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("does not revalidate on failure", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: false, error: "Invalid date." });
    const result = await editAppliedDate(4, "not-a-date");
    expect(result).toEqual({ ok: false, error: "Invalid date." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("runManualSync", () => {
  test("calls runSync with 'manual' and returns its result on success", async () => {
    const syncResult = {
      messages: 1,
      cards: 1,
      unique: 1,
      inserted: 1,
      skipped: 0,
      warnings: 0,
      parserFailureCount: 0,
      parserFailures: [],
      failures: [],
    };
    runSyncMock.mockResolvedValue(syncResult);

    const response = await runManualSync();

    expect(runSyncMock).toHaveBeenCalledWith("manual");
    expect(response).toEqual({ ok: true, result: syncResult });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("returns a safe error message and still revalidates when runSync throws", async () => {
    runSyncMock.mockRejectedValue(new Error("gmail unreachable"));

    const response = await runManualSync();

    expect(response).toEqual({ ok: false, message: "gmail unreachable" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });
});
