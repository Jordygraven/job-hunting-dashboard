// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SyncsTable } from "./SyncsTable";
import { LIST_NOT_AVAILABLE, type SourceGroup } from "@/lib/sync/getSyncVacancies";
import type { SourceResult, SyncRunRecord } from "@/lib/sync/syncRunRecord";

afterEach(cleanup);

function run(overrides: Partial<SyncRunRecord> = {}): SyncRunRecord {
  return {
    id: 1,
    runId: "r1",
    trigger: "manual",
    status: "ok",
    startedAt: "2026-10-14T01:00:00Z",
    finishedAt: "2026-10-14T01:01:00Z",
    messages: 1,
    cards: 1,
    uniqueJobs: 1,
    inserted: 2,
    skipped: 0,
    warnings: 0,
    parserFailureCount: 0,
    sourceResults: [{ source: "linkedin", found: 2, inserted: 2, skipped: 0, failed: 0 }],
    parserFailures: [],
    failures: [],
    warningDetails: [],
    error: null,
    ...overrides,
  };
}

const linkedin: SourceGroup = {
  source: "linkedin",
  label: "LinkedIn",
  inserted: 2,
  lines: [{ title: "Dev", company: "Acme", url: "https://x.test/1" }],
  more: 0,
};

describe("SyncsTable", () => {
  test("only the first row is open when openFirst", () => {
    const { container } = render(
      <SyncsTable
        runs={[run({ id: 2 }), run({ id: 1 })]}
        vacancies={new Map([[2, [linkedin]], [1, [linkedin]]])}
        openFirst
      />
    );
    const rows = container.querySelectorAll("details");
    expect(rows[0]).toHaveAttribute("open");
    expect(rows[1]).not.toHaveAttribute("open");
  });

  test("all collapsed when not openFirst", () => {
    const { container } = render(
      <SyncsTable runs={[run()]} vacancies={new Map([[1, [linkedin]]])} openFirst={false} />
    );
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  test("0-new sync shows '0 new'", () => {
    render(<SyncsTable runs={[run({ inserted: 0 })]} vacancies={new Map()} openFirst={false} />);
    expect(screen.getByText("0 new")).toBeInTheDocument();
  });

  test("old run shows dash and not-available text", () => {
    render(
      <SyncsTable
        runs={[run({ runId: null, sourceResults: null })]}
        vacancies={new Map([[1, LIST_NOT_AVAILABLE]])}
        openFirst
      />
    );
    expect(screen.getByText("— vacancy list not available")).toBeInTheDocument();
  });

  test("vacancy line has safe external link", () => {
    render(<SyncsTable runs={[run()]} vacancies={new Map([[1, [linkedin]]])} openFirst />);
    const link = screen.getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute("href", "https://x.test/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText("found 2 · inserted 2 · skipped 0 · failed 0")).toBeInTheDocument();
  });

  test("unknown board shows identifier and count only", () => {
    const unknown: SourceGroup = {
      source: "greenhouse",
      label: "oldboard",
      inserted: 4,
      lines: null,
      more: 4,
    };
    render(
      <SyncsTable
        runs={[
          run({
            sourceResults: [
              { source: "greenhouse", board: "oldboard", found: 4, inserted: 4, skipped: 0, failed: 0 },
            ],
          }),
        ]}
        vacancies={new Map([[1, [unknown]]])}
        openFirst
      />
    );
    expect(screen.getByText("Greenhouse · oldboard")).toBeInTheDocument();
    expect(screen.getByText("4 new")).toBeInTheDocument();
    expect(screen.queryByText(/found/)).toBeNull();
    expect(screen.queryByText(/and \d+ more/)).toBeNull();
  });

  test("shows 'and N more' when above 0", () => {
    render(
      <SyncsTable runs={[run()]} vacancies={new Map([[1, [{ ...linkedin, more: 7 }]]])} openFirst />
    );
    expect(screen.getByText("and 7 more")).toBeInTheDocument();
  });

  test("whole-sync problems on top, source problems under their own source", () => {
    const gh: SourceGroup = {
      source: "greenhouse",
      label: "Bybit",
      inserted: 0,
      lines: [],
      more: 0,
    };
    render(
      <SyncsTable
        runs={[
          run({
            status: "error",
            error: "Gmail crashed",
            sourceResults: [
              { source: "linkedin", found: 2, inserted: 2, skipped: 0, failed: 0 },
              { source: "greenhouse", board: "bybit", found: 0, inserted: 0, skipped: 0, failed: 1 },
            ],
            failures: [
              { messageId: "bybit", jobId: null, reason: "Board fetch failed", source: "greenhouse", board: "bybit" },
            ],
          }),
        ]}
        vacancies={new Map([[1, [linkedin, gh]]])}
        openFirst
      />
    );
    expect(screen.getByText("Gmail crashed")).toBeInTheDocument();
    const ghBlock = screen.getByText("Greenhouse · Bybit").parentElement!;
    expect(within(ghBlock).getByText("Board fetch failed")).toBeInTheDocument();
    const liBlock = screen.getByText("LinkedIn").parentElement!;
    expect(within(liBlock).queryByText("Board fetch failed")).toBeNull();
  });

  test("zero-count entry with a reason key renders as plain zeros", () => {
    const gh: SourceGroup = { source: "greenhouse", label: "X", inserted: 0, lines: [], more: 0 };
    render(
      <SyncsTable
        runs={[
          run({
            sourceResults: [
              // `reason` joins SourceResult in Task 5; jsonb already lets it through.
              { source: "greenhouse", board: "x", found: 0, inserted: 0, skipped: 0, failed: 0, reason: "not_due" } as SourceResult,
            ],
          }),
        ]}
        vacancies={new Map([[1, [gh]]])}
        openFirst
      />
    );
    expect(screen.getByText("Greenhouse · X")).toBeInTheDocument();
    expect(screen.getByText("found 0 · inserted 0 · skipped 0 · failed 0")).toBeInTheDocument();
  });
});
