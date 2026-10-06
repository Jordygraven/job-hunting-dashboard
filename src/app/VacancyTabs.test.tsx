// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VacancyTabs } from "./VacancyTabs";

afterEach(() => {
  cleanup();
});

describe("VacancyTabs", () => {
  test("marks the active tab with aria-current and shows each tab's count", () => {
    render(
      <VacancyTabs view="applied" counts={{ todo: 2, applied: 1, ignored: 3, all: 6 }} reasonFilter={null} />
    );
    const activeTab = screen.getByRole("link", { name: /applied \(1\)/i });
    expect(activeTab).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /to do \(2\)/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /all \(6\)/i })).toBeInTheDocument();
  });

  test("shows the reason filter links only on the ignored tab", () => {
    render(<VacancyTabs view="todo" counts={{ todo: 0, applied: 0, ignored: 0, all: 0 }} reasonFilter={null} />);
    expect(screen.queryByRole("link", { name: "No reason" })).not.toBeInTheDocument();
  });

  test("marks the active reason filter on the ignored tab", () => {
    render(
      <VacancyTabs view="ignored" counts={{ todo: 0, applied: 0, ignored: 2, all: 2 }} reasonFilter="language" />
    );
    expect(screen.getByRole("link", { name: "Language" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All reasons" })).not.toHaveAttribute("aria-current");
  });

  test("tab links carry the right href", () => {
    render(<VacancyTabs view="todo" counts={{ todo: 0, applied: 0, ignored: 0, all: 0 }} reasonFilter={null} />);
    expect(screen.getByRole("link", { name: /applied/i })).toHaveAttribute("href", "/?view=applied");
  });
});
