// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VacancyTable } from "./VacancyTable";
import type { VacancyTabRow } from "@/lib/vacancyActions/vacancyTabs";

afterEach(() => {
  cleanup();
});

function row(overrides: Partial<VacancyTabRow> = {}): VacancyTabRow {
  return {
    id: 1,
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://example.com/job/1",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    status: "todo",
    appliedOn: null,
    ignoredOn: null,
    ignoreReason: null,
    ...overrides,
  };
}

describe("VacancyTable — empty states", () => {
  test("shows the todo empty state", () => {
    render(<VacancyTable view="todo" rows={[]} />);
    expect(screen.getByText("No vacancies to triage.")).toBeInTheDocument();
  });

  test("shows the applied empty state", () => {
    render(<VacancyTable view="applied" rows={[]} />);
    expect(screen.getByText("No applied vacancies yet.")).toBeInTheDocument();
  });

  test("shows the ignored empty state", () => {
    render(<VacancyTable view="ignored" rows={[]} />);
    expect(screen.getByText("No ignored vacancies yet.")).toBeInTheDocument();
  });

  test("shows the all empty state", () => {
    render(<VacancyTable view="all" rows={[]} />);
    expect(screen.getByText("No vacancies yet.")).toBeInTheDocument();
  });
});

describe("VacancyTable — row rendering", () => {
  test("renders a null location as an empty cell, not a crash or the word null", () => {
    render(<VacancyTable view="todo" rows={[row({ location: null })]} />);
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  test("column headers have scope=col", () => {
    render(<VacancyTable view="todo" rows={[row()]} />);
    expect(screen.getByRole("columnheader", { name: "Title" })).toHaveAttribute("scope", "col");
  });

  test("the applied tab adds an Applied on column", () => {
    render(<VacancyTable view="applied" rows={[row({ status: "applied", appliedOn: "2026-10-02" })]} />);
    expect(screen.getByRole("columnheader", { name: "Applied on" })).toBeInTheDocument();
  });

  test("the ignored tab adds Ignored on and Reason columns", () => {
    render(
      <VacancyTable
        view="ignored"
        rows={[row({ status: "ignored", ignoredOn: "2026-10-02", ignoreReason: "interest" })]}
      />
    );
    expect(screen.getByRole("columnheader", { name: "Ignored on" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Reason" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Interest" })).toBeInTheDocument();
  });

  test("the all tab adds a Status column", () => {
    render(<VacancyTable view="all" rows={[row({ status: "ignored" })]} />);
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
  });

  test("the all tab's status cell reads 'To do', matching the tab label, not raw 'todo'", () => {
    render(<VacancyTable view="all" rows={[row({ status: "todo" })]} />);
    expect(screen.getByRole("cell", { name: "To do" })).toBeInTheDocument();
  });
});
