// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VacancyTabs } from "./VacancyTabs";
import type { VacancyTabCounts } from "@/lib/vacancyActions/vacancyTabs";

afterEach(() => {
  cleanup();
});

const BASE = { status: null, q: null, company: null, from: null, to: null, sort: null, dir: null };

function counts(overrides: Partial<VacancyTabCounts> = {}): VacancyTabCounts {
  return { todo: 0, applied: 0, success: 0, rejected: 0, ignored: 0, all: 0, interest: 0, autodraft: 0, ...overrides };
}

describe("VacancyTabs", () => {
  test("marks the active tab with aria-current and shows each tab's count", () => {
    render(
      <VacancyTabs
        view="applied"
        counts={counts({ todo: 2, applied: 1, ignored: 3, all: 6 })}
        reasonFilter={null}
        show={10}
        {...BASE}
      />
    );
    const activeTab = screen.getByRole("link", { name: /applied \(1\)/i });
    expect(activeTab).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /to do \(2\)/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /^all \(6\)/i })).toBeInTheDocument();
  });

  test("lists all eight tabs, in order", () => {
    render(<VacancyTabs view="todo" counts={counts()} reasonFilter={null} show={10} {...BASE} />);
    const tabNav = screen.getByRole("navigation", { name: "Vacancy tabs" });
    const labels = Array.from(tabNav.querySelectorAll("a")).map((a) => a.textContent?.replace(/\s*\(\d+\)$/, ""));
    expect(labels).toEqual(["To do", "Interest", "Applied", "All", "Success", "Rejected", "Ignored", "Auto-draft"]);
  });

  test("the Interest tab shows its own count, independent of All's count", () => {
    render(
      <VacancyTabs
        view="todo"
        counts={counts({ todo: 2, applied: 3, ignored: 1, all: 6, interest: 4 })}
        reasonFilter={null}
        show={10}
        {...BASE}
      />
    );
    expect(screen.getByRole("link", { name: /interest \(4\)/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^all \(6\)/i })).toBeInTheDocument();
  });

  test("the Auto-draft tab shows its own count and links to view=autodraft", () => {
    render(<VacancyTabs view="todo" counts={counts({ all: 6, autodraft: 2 })} reasonFilter={null} show={10} {...BASE} />);
    expect(screen.getByRole("link", { name: /auto-draft \(2\)/i })).toHaveAttribute("href", "/?view=autodraft");
  });

  test("shows the reason filter links only on the ignored tab", () => {
    render(<VacancyTabs view="todo" counts={counts()} reasonFilter={null} show={10} {...BASE} />);
    expect(screen.queryByRole("link", { name: "No reason" })).not.toBeInTheDocument();
  });

  test("marks the active reason filter on the ignored tab", () => {
    render(
      <VacancyTabs
        view="ignored"
        counts={counts({ ignored: 2, all: 2 })}
        reasonFilter="language"
        show={10}
        {...BASE}
      />
    );
    expect(screen.getByRole("link", { name: "Language" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All reasons" })).not.toHaveAttribute("aria-current");
  });

  test("tab links carry the right href", () => {
    render(<VacancyTabs view="todo" counts={counts()} reasonFilter={null} show={10} {...BASE} />);
    expect(screen.getByRole("link", { name: /applied/i })).toHaveAttribute("href", "/?view=applied");
    expect(screen.getByRole("link", { name: /interest/i })).toHaveAttribute("href", "/?view=interest");
    expect(screen.getByRole("link", { name: /^success/i })).toHaveAttribute("href", "/?view=success");
    expect(screen.getByRole("link", { name: /^rejected/i })).toHaveAttribute("href", "/?view=rejected");
  });

  test("tab links carry a non-default show value", () => {
    render(<VacancyTabs view="todo" counts={counts()} reasonFilter={null} show={20} {...BASE} />);
    expect(screen.getByRole("link", { name: /applied/i })).toHaveAttribute(
      "href",
      "/?view=applied&show=20"
    );
  });

  test("reason filter links carry a non-default show value", () => {
    render(<VacancyTabs view="ignored" counts={counts()} reasonFilter={null} show="all" {...BASE} />);
    expect(screen.getByRole("link", { name: "Language" })).toHaveAttribute(
      "href",
      "/?view=ignored&reason=language&show=all"
    );
  });

  test("tab and reason links carry q, company, from, to", () => {
    render(
      <VacancyTabs
        view="ignored"
        counts={counts()}
        reasonFilter={null}
        show={10}
        status={null}
        q="engineer"
        company="Acme"
        from="2026-10-01"
        to="2026-10-31"
      />
    );
    expect(screen.getByRole("link", { name: /applied/i })).toHaveAttribute(
      "href",
      "/?view=applied&q=engineer&company=Acme&from=2026-10-01&to=2026-10-31"
    );
    expect(screen.getByRole("link", { name: "Language" })).toHaveAttribute(
      "href",
      "/?view=ignored&reason=language&q=engineer&company=Acme&from=2026-10-01&to=2026-10-31"
    );
  });

  test("status is carried on the all tab link but dropped from every other tab link", () => {
    render(
      <VacancyTabs
        view="all"
        counts={counts()}
        reasonFilter={null}
        show={10}
        status="applied"
        q={null}
        company={null}
        from={null}
        to={null}
        sort={null}
        dir={null}
      />
    );
    expect(screen.getByRole("link", { name: /^All/ })).toHaveAttribute(
      "href",
      "/?view=all&status=applied"
    );
    expect(screen.getByRole("link", { name: /to do/i })).toHaveAttribute("href", "/?view=todo");
  });

  test("status is carried on the interest tab link too", () => {
    render(
      <VacancyTabs
        view="interest"
        counts={counts()}
        reasonFilter={null}
        show={10}
        status="success"
        q={null}
        company={null}
        from={null}
        to={null}
        sort={null}
        dir={null}
      />
    );
    expect(screen.getByRole("link", { name: /interest/i })).toHaveAttribute(
      "href",
      "/?view=interest&status=success"
    );
  });

  test("tab and reason links carry sort and dir when the column applies on the target tab", () => {
    render(
      <VacancyTabs
        view="all"
        counts={counts()}
        reasonFilter={null}
        show={10}
        status={null}
        q={null}
        company={null}
        from={null}
        to={null}
        sort="title"
        dir="asc"
      />
    );
    expect(screen.getByRole("link", { name: /applied/i })).toHaveAttribute(
      "href",
      "/?view=applied&sort=title&dir=asc"
    );
  });

  test("tab links drop sort and dir when the column doesn't apply on the target tab", () => {
    render(
      <VacancyTabs
        view="all"
        counts={counts()}
        reasonFilter={null}
        show={10}
        status={null}
        q={null}
        company={null}
        from={null}
        to={null}
        sort="status"
        dir="asc"
      />
    );
    expect(screen.getByRole("link", { name: /to do/i })).toHaveAttribute("href", "/?view=todo");
  });
});
