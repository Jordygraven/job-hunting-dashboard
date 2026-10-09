// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VacancyPagination } from "./VacancyPagination";

afterEach(() => {
  cleanup();
});

const BASE = { status: null, q: null, company: null, from: null, to: null, sort: null, dir: null };

describe("VacancyPagination", () => {
  test("renders nothing for 10 or fewer rows", () => {
    const { container } = render(
      <VacancyPagination view="todo" reasonFilter={null} show={10} filteredCount={10} {...BASE} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("shows a Read more link to show=20 when more than 10 rows are hidden", () => {
    render(<VacancyPagination view="todo" reasonFilter={null} show={10} filteredCount={15} {...BASE} />);
    expect(screen.getByText("Showing 10 of 15")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute(
      "href",
      "/?view=todo&show=20"
    );
  });

  test("shows a Show all link once 20 rows are shown but more remain", () => {
    render(
      <VacancyPagination view="ignored" reasonFilter="language" show={20} filteredCount={21} {...BASE} />
    );
    expect(screen.getByText("Showing 20 of 21")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all (21)" })).toHaveAttribute(
      "href",
      "/?view=ignored&reason=language&show=all"
    );
  });

  test("shows no link once every row is visible", () => {
    render(<VacancyPagination view="todo" reasonFilter={null} show="all" filteredCount={15} {...BASE} />);
    expect(screen.getByText("Showing 15 of 15")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("the more link carries q, company, from, to", () => {
    render(
      <VacancyPagination
        view="todo"
        reasonFilter={null}
        show={10}
        filteredCount={15}
        status={null}
        q="engineer"
        company="Acme"
        from="2026-10-01"
        to="2026-10-31"
      />
    );
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute(
      "href",
      "/?view=todo&show=20&q=engineer&company=Acme&from=2026-10-01&to=2026-10-31"
    );
  });

  test("the more link carries status only on the all tab", () => {
    render(
      <VacancyPagination view="all" reasonFilter={null} show={10} filteredCount={15} {...BASE} status="todo" />
    );
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute(
      "href",
      "/?view=all&status=todo&show=20"
    );
  });

  test("the more link carries sort and dir when the column applies on this tab", () => {
    render(
      <VacancyPagination
        view="all"
        reasonFilter={null}
        show={10}
        filteredCount={15}
        status={null}
        q={null}
        company={null}
        from={null}
        to={null}
        sort="status"
        dir="desc"
      />
    );
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute(
      "href",
      "/?view=all&show=20&sort=status&dir=desc"
    );
  });

  test("the more link drops sort and dir when the column doesn't apply on this tab", () => {
    render(
      <VacancyPagination
        view="todo"
        reasonFilter={null}
        show={10}
        filteredCount={15}
        status={null}
        q={null}
        company={null}
        from={null}
        to={null}
        sort="status"
        dir="desc"
      />
    );
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute("href", "/?view=todo&show=20");
  });
});
