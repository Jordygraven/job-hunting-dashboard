// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VacancyFilterBar } from "./VacancyFilterBar";

afterEach(() => {
  cleanup();
});

describe("VacancyFilterBar", () => {
  test("is a plain GET form to /", () => {
    render(
      <VacancyFilterBar
        view="todo"
        reasonFilter={null}
        q={null}
        company={null}
        from={null}
        to={null}
        status={null}
        companies={[]}
        hasActiveFilters={false}
      />
    );
    expect(document.querySelector("form")).toHaveAttribute("method", "get");
    expect(document.querySelector("form")).toHaveAttribute("action", "/");
  });

  test("prefills fields from props", () => {
    render(
      <VacancyFilterBar
        view="todo"
        reasonFilter={null}
        q="engineer"
        company="Acme"
        from="2026-10-01"
        to="2026-10-31"
        status={null}
        companies={["Acme", "Beta"]}
        hasActiveFilters={true}
      />
    );
    expect(screen.getByLabelText("Search")).toHaveValue("engineer");
    expect(screen.getByLabelText("Company")).toHaveValue("Acme");
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-10-31");
  });

  test("company dropdown lists every passed-in company plus 'All companies'", () => {
    render(
      <VacancyFilterBar
        view="todo"
        reasonFilter={null}
        q={null}
        company={null}
        from={null}
        to={null}
        status={null}
        companies={["Acme", "Beta"]}
        hasActiveFilters={false}
      />
    );
    expect(screen.getByRole("option", { name: "All companies" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
  });

  test("status dropdown only renders on the all tab", () => {
    render(
      <VacancyFilterBar
        view="todo"
        reasonFilter={null}
        q={null}
        company={null}
        from={null}
        to={null}
        status={null}
        companies={[]}
        hasActiveFilters={false}
      />
    );
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  test("status dropdown renders and is prefilled on the all tab", () => {
    render(
      <VacancyFilterBar
        view="all"
        reasonFilter={null}
        q={null}
        company={null}
        from={null}
        to={null}
        status="applied"
        companies={[]}
        hasActiveFilters={true}
      />
    );
    expect(screen.getByLabelText("Status")).toHaveValue("applied");
  });

  test("carries view and reason as hidden fields", () => {
    render(
      <VacancyFilterBar
        view="ignored"
        reasonFilter="language"
        q={null}
        company={null}
        from={null}
        to={null}
        status={null}
        companies={[]}
        hasActiveFilters={false}
      />
    );
    const form = document.querySelector("form") as HTMLFormElement;
    expect(form.querySelector('input[name="view"]')).toHaveValue("ignored");
    expect(form.querySelector('input[name="reason"]')).toHaveValue("language");
  });

  test("Clear filters link only renders when a filter is active, and clears every filter", () => {
    const { rerender } = render(
      <VacancyFilterBar
        view="todo"
        reasonFilter={null}
        q={null}
        company={null}
        from={null}
        to={null}
        status={null}
        companies={[]}
        hasActiveFilters={false}
      />
    );
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();

    rerender(
      <VacancyFilterBar
        view="todo"
        reasonFilter={null}
        q="engineer"
        company={null}
        from={null}
        to={null}
        status={null}
        companies={[]}
        hasActiveFilters={true}
      />
    );
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/?view=todo");
  });

  test("fields follow the URL after in-page navigation, e.g. Clear filters", () => {
    const { rerender } = render(
      <VacancyFilterBar
        view="all"
        reasonFilter={null}
        q="engineer"
        company="Acme"
        from="2026-10-01"
        to="2026-10-31"
        status="applied"
        companies={["Acme", "Beta"]}
        hasActiveFilters={true}
      />
    );
    expect(screen.getByLabelText("Search")).toHaveValue("engineer");
    expect(screen.getByLabelText("Status")).toHaveValue("applied");

    // Simulate the navigation a "Clear filters" click produces: the same
    // component re-rendered with fresh (empty) filter props.
    rerender(
      <VacancyFilterBar
        view="all"
        reasonFilter={null}
        q={null}
        company={null}
        from={null}
        to={null}
        status={null}
        companies={["Acme", "Beta"]}
        hasActiveFilters={false}
      />
    );

    expect(screen.getByLabelText("Search")).toHaveValue("");
    expect(screen.getByLabelText("Company")).toHaveValue("");
    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.getByLabelText("To")).toHaveValue("");
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });

  test("disables empty fields on submit so they're left out of the query string", () => {
    render(
      <VacancyFilterBar
        view="todo"
        reasonFilter={null}
        q="engineer"
        company={null}
        from={null}
        to={null}
        status={null}
        companies={[]}
        hasActiveFilters={true}
      />
    );

    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    expect(screen.getByLabelText("Search")).not.toBeDisabled();
    expect(screen.getByLabelText("Company")).toBeDisabled();
    expect(screen.getByLabelText("From")).toBeDisabled();
    expect(screen.getByLabelText("To")).toBeDisabled();
    expect(form.querySelector('input[name="view"]')).not.toBeDisabled();
  });
});
