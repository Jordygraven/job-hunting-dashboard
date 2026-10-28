// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VacancyTable } from "./VacancyTable";
import type { VacancyTabRow } from "@/lib/vacancyActions/vacancyTabs";

afterEach(() => {
  cleanup();
});

const NO_FILTERS = { hasActiveFilters: false, clearFiltersHref: "/?view=todo" };

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
    outcomeOn: null,
    ignoredOn: null,
    ignoreReason: null,
    starred: false,
    autoDraft: false,
    pilot: false,
    drafted: false,
    ...overrides,
  };
}

describe("VacancyTable — empty states", () => {
  test("shows the todo empty state", () => {
    render(<VacancyTable view="todo" rows={[]} {...NO_FILTERS} />);
    expect(screen.getByText("No vacancies to triage.")).toBeInTheDocument();
  });

  test("shows the applied empty state", () => {
    render(<VacancyTable view="applied" rows={[]} {...NO_FILTERS} />);
    expect(screen.getByText("No applied vacancies yet.")).toBeInTheDocument();
  });

  test("shows the ignored empty state", () => {
    render(<VacancyTable view="ignored" rows={[]} {...NO_FILTERS} />);
    expect(screen.getByText("No ignored vacancies yet.")).toBeInTheDocument();
  });

  test("shows the all empty state", () => {
    render(<VacancyTable view="all" rows={[]} {...NO_FILTERS} />);
    expect(screen.getByText("No vacancies yet.")).toBeInTheDocument();
  });

  test("shows the interest empty state", () => {
    render(<VacancyTable view="interest" rows={[]} {...NO_FILTERS} />);
    expect(screen.getByText("No starred vacancies yet.")).toBeInTheDocument();
  });

  test("shows the success empty state", () => {
    render(<VacancyTable view="success" rows={[]} {...NO_FILTERS} />);
    expect(screen.getByText("No successful vacancies yet.")).toBeInTheDocument();
  });

  test("shows the rejected empty state", () => {
    render(<VacancyTable view="rejected" rows={[]} {...NO_FILTERS} />);
    expect(screen.getByText("No rejected vacancies yet.")).toBeInTheDocument();
  });

  test("shows 'No vacancies match' plus a Clear filters link when a filter is active and nothing matches", () => {
    render(
      <VacancyTable view="todo" rows={[]} hasActiveFilters={true} clearFiltersHref="/?view=todo" />
    );
    expect(screen.getByText(/No vacancies match\./)).toBeInTheDocument();
    expect(screen.queryByText("No vacancies to triage.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/?view=todo");
  });
});

describe("VacancyTable — row rendering", () => {
  test("renders a null location as an empty cell, not a crash or the word null", () => {
    render(<VacancyTable view="todo" rows={[row({ location: null })]} {...NO_FILTERS} />);
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  test("column headers have scope=col", () => {
    render(<VacancyTable view="todo" rows={[row()]} {...NO_FILTERS} />);
    expect(screen.getByRole("columnheader", { name: "Title" })).toHaveAttribute("scope", "col");
  });

  test("the applied tab adds an Applied on column", () => {
    render(
      <VacancyTable
        view="applied"
        rows={[row({ status: "applied", appliedOn: "2026-10-02" })]}
        {...NO_FILTERS}
      />
    );
    expect(screen.getByRole("columnheader", { name: "Applied on" })).toBeInTheDocument();
  });

  test("the ignored tab adds Ignored on and Reason columns", () => {
    render(
      <VacancyTable
        view="ignored"
        rows={[row({ status: "ignored", ignoredOn: "2026-10-02", ignoreReason: "interest" })]}
        {...NO_FILTERS}
      />
    );
    expect(screen.getByRole("columnheader", { name: "Ignored on" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Reason" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Interest" })).toBeInTheDocument();
  });

  test("the all tab adds a Status column", () => {
    render(<VacancyTable view="all" rows={[row({ status: "ignored" })]} {...NO_FILTERS} />);
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
  });

  test("the all tab's status cell reads 'To do', matching the tab label, not raw 'todo'", () => {
    render(<VacancyTable view="all" rows={[row({ status: "todo" })]} {...NO_FILTERS} />);
    expect(screen.getByRole("cell", { name: "To do" })).toBeInTheDocument();
  });

  test.each(["todo", "applied", "ignored", "success", "rejected"] as const)(
    "a %s row shows auto-draft and pilot toggles reflecting its flags",
    (status) => {
      render(<VacancyTable view="all" rows={[row({ status, autoDraft: true, pilot: false })]} {...NO_FILTERS} />);
      expect(screen.getByRole("button", { name: "Unmark auto-draft" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Mark as pilot" })).toHaveAttribute("aria-pressed", "false");
    }
  );

  test("the interest tab also adds a Status column", () => {
    render(<VacancyTable view="interest" rows={[row({ status: "applied", starred: true })]} {...NO_FILTERS} />);
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Applied" })).toBeInTheDocument();
  });

  test("the success tab adds Applied on and Outcome on columns", () => {
    render(
      <VacancyTable
        view="success"
        rows={[row({ status: "success", appliedOn: "2026-10-01", outcomeOn: "2026-10-05" })]}
        {...NO_FILTERS}
      />
    );
    expect(screen.getByRole("columnheader", { name: "Applied on" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Outcome on" })).toBeInTheDocument();
  });

  test("the rejected tab adds Applied on and Outcome on columns too", () => {
    render(
      <VacancyTable
        view="rejected"
        rows={[row({ status: "rejected", appliedOn: "2026-10-01", outcomeOn: "2026-10-08" })]}
        {...NO_FILTERS}
      />
    );
    expect(screen.getByRole("columnheader", { name: "Applied on" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Outcome on" })).toBeInTheDocument();
  });

  test("Outcome on is not a column on the all tab", () => {
    render(<VacancyTable view="all" rows={[row({ status: "success" })]} {...NO_FILTERS} />);
    expect(screen.queryByRole("columnheader", { name: "Outcome on" })).not.toBeInTheDocument();
  });
});

describe("VacancyTable — Auto-draft column", () => {
  test.each(["todo", "interest", "applied", "all", "success", "rejected", "ignored"] as const)(
    "the %s view has an Auto-draft header and an auto-draft cell with a titled button",
    (view) => {
      render(<VacancyTable view={view} rows={[row({ status: "applied" })]} {...NO_FILTERS} />);
      expect(screen.getByRole("columnheader", { name: "Auto-draft" })).toHaveAttribute("title", "Auto-draft");
      const button = screen.getByRole("button", { name: "Mark for auto-draft" });
      expect(button).toHaveAttribute("title", "Mark for auto-draft");
      expect(button.closest("td")).not.toBeNull();
    }
  );
});

describe("VacancyTable — Star column", () => {
  test("every view has a Star column header", () => {
    render(<VacancyTable view="todo" rows={[row()]} {...NO_FILTERS} />);
    expect(screen.getByRole("columnheader", { name: "Star" })).toBeInTheDocument();
  });

  test("a To do row shows an interactive star button", () => {
    render(<VacancyTable view="todo" rows={[row({ status: "todo" })]} {...NO_FILTERS} />);
    expect(screen.getByRole("button", { name: "Star" })).toBeInTheDocument();
  });

  test("a starred non-todo row on a non-interest tab shows a static indicator, no button", () => {
    render(<VacancyTable view="applied" rows={[row({ status: "applied", starred: true })]} {...NO_FILTERS} />);
    expect(screen.getByLabelText("Starred")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unstar" })).not.toBeInTheDocument();
  });

  test("an unstarred non-todo row shows no star indicator or star/unstar button", () => {
    render(<VacancyTable view="applied" rows={[row({ status: "applied", starred: false })]} {...NO_FILTERS} />);
    expect(screen.queryByLabelText("Starred")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Star" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unstar" })).not.toBeInTheDocument();
  });

  test("on the Interest tab, a starred row shows an interactive Unstar button regardless of status", () => {
    render(
      <VacancyTable
        view="interest"
        rows={[row({ status: "applied", starred: true })]}
        {...NO_FILTERS}
      />
    );
    expect(screen.getByRole("button", { name: "Unstar" })).toBeInTheDocument();
  });

  test("a starred row gets the starred-row highlight class, unconditional on sort state", () => {
    render(<VacancyTable view="todo" rows={[row({ status: "todo", starred: true })]} {...NO_FILTERS} sort="title" dir="asc" />);
    const row_ = screen.getByRole("row", { name: /Engineer/ });
    expect(row_.className).toContain("bg-surface-row-starred");
  });
});

describe("VacancyTable — sortable headers", () => {
  test("an unsorted header link sorts ascending on first click", () => {
    render(<VacancyTable view="todo" rows={[row()]} {...NO_FILTERS} sort={null} dir={null} />);
    expect(screen.getByRole("link", { name: "Title" })).toHaveAttribute(
      "href",
      "/?view=todo&sort=title&dir=asc"
    );
  });

  test("clicking the active ascending header sorts it descending next", () => {
    render(<VacancyTable view="todo" rows={[row()]} {...NO_FILTERS} sort="title" dir="asc" />);
    expect(screen.getByRole("link", { name: /Title/ })).toHaveAttribute(
      "href",
      "/?view=todo&sort=title&dir=desc"
    );
  });

  test("clicking the active descending header clears the sort next", () => {
    render(<VacancyTable view="todo" rows={[row()]} {...NO_FILTERS} sort="title" dir="desc" />);
    expect(screen.getByRole("link", { name: /Title/ })).toHaveAttribute("href", "/?view=todo");
  });

  test("clicking a different header while one is active resets that column to asc, and carries current filters", () => {
    render(
      <VacancyTable
        view="todo"
        rows={[row()]}
        {...NO_FILTERS}
        sort="title"
        dir="desc"
        q="engineer"
        company="Acme"
      />
    );
    expect(screen.getByRole("link", { name: "Company" })).toHaveAttribute(
      "href",
      "/?view=todo&q=engineer&company=Acme&sort=company&dir=asc"
    );
  });

  test("aria-sort reflects the active column and direction; other sortable columns are none", () => {
    render(<VacancyTable view="todo" rows={[row()]} {...NO_FILTERS} sort="company" dir="desc" />);
    expect(screen.getByRole("columnheader", { name: /Title/ })).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("columnheader", { name: /Company/ })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
  });

  test("Link and Actions headers are plain text, not links, and carry no aria-sort", () => {
    render(<VacancyTable view="todo" rows={[row()]} {...NO_FILTERS} sort="title" dir="asc" />);
    const linkHeader = screen.getByRole("columnheader", { name: "Link" });
    const actionsHeader = screen.getByRole("columnheader", { name: "Actions" });
    expect(linkHeader).not.toHaveAttribute("aria-sort");
    expect(actionsHeader).not.toHaveAttribute("aria-sort");
    expect(screen.queryByRole("link", { name: "Actions" })).not.toBeInTheDocument();
  });
});
