// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VacancyPagination } from "./VacancyPagination";

afterEach(() => {
  cleanup();
});

describe("VacancyPagination", () => {
  test("renders nothing for 10 or fewer rows", () => {
    const { container } = render(
      <VacancyPagination view="todo" reasonFilter={null} show={10} filteredCount={10} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("shows a Read more link to show=20 when more than 10 rows are hidden", () => {
    render(<VacancyPagination view="todo" reasonFilter={null} show={10} filteredCount={15} />);
    expect(screen.getByText("Showing 10 of 15")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute(
      "href",
      "/?view=todo&show=20"
    );
  });

  test("shows a Show all link once 20 rows are shown but more remain", () => {
    render(<VacancyPagination view="ignored" reasonFilter="language" show={20} filteredCount={21} />);
    expect(screen.getByText("Showing 20 of 21")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all (21)" })).toHaveAttribute(
      "href",
      "/?view=ignored&reason=language&show=all"
    );
  });

  test("shows no link once every row is visible", () => {
    render(<VacancyPagination view="todo" reasonFilter={null} show="all" filteredCount={15} />);
    expect(screen.getByText("Showing 15 of 15")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
