// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SyncDetails } from "./SyncDetails";
import type { SyncRunRecord } from "@/lib/sync/syncRunRecord";

afterEach(() => {
  cleanup();
});

function run(overrides: Partial<SyncRunRecord> = {}): SyncRunRecord {
  return {
    id: 1,
    runId: null,
    trigger: "cron",
    status: "ok",
    startedAt: "2026-10-06T11:00:00.000Z",
    finishedAt: "2026-10-06T11:05:00.000Z",
    messages: 2,
    cards: 3,
    uniqueJobs: 3,
    inserted: 3,
    skipped: 0,
    warnings: 0,
    parserFailureCount: 0,
    sourceResults: null,
    parserFailures: [],
    failures: [],
    warningDetails: [],
    error: null,
    ...overrides,
  };
}

describe("SyncDetails — warnings without recorded details", () => {
  test("shows a fallback message when warnings > 0 but warning_details is empty", () => {
    render(<SyncDetails recentRuns={[run({ warnings: 1, warningDetails: [] })]} defaultOpen={true} />);
    expect(screen.getByText("Details not recorded for this run.")).toBeInTheDocument();
  });

  test("does not show the fallback message when warning_details is populated", () => {
    render(
      <SyncDetails
        recentRuns={[
          run({
            warnings: 1,
            warningDetails: [{ messageId: "m1", jobId: "1", reason: "unrecognized extra line inside card", source: "linkedin" }],
          }),
        ]}
        defaultOpen={true}
      />
    );
    expect(screen.queryByText("Details not recorded for this run.")).not.toBeInTheDocument();
  });

  test("does not show the fallback message when there are no warnings", () => {
    render(<SyncDetails recentRuns={[run({ warnings: 0, warningDetails: [] })]} defaultOpen={true} />);
    expect(screen.queryByText("Details not recorded for this run.")).not.toBeInTheDocument();
  });
});
