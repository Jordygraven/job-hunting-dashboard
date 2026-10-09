// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test, vi } from "vitest";
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

  test("re-enables fields on pageshow when the page is restored from bfcache", () => {
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
    expect(screen.getByLabelText("Company")).toBeDisabled();
    expect(screen.getByLabelText("From")).toBeDisabled();

    const pageShowEvent = new Event("pageshow");
    Object.defineProperty(pageShowEvent, "persisted", { value: true });
    window.dispatchEvent(pageShowEvent);

    expect(screen.getByLabelText("Company")).not.toBeDisabled();
    expect(screen.getByLabelText("From")).not.toBeDisabled();
    expect(screen.getByLabelText("To")).not.toBeDisabled();
  });

  test("does not re-enable fields on a non-persisted pageshow (plain page load)", () => {
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
    expect(screen.getByLabelText("Company")).toBeDisabled();

    const pageShowEvent = new Event("pageshow");
    Object.defineProperty(pageShowEvent, "persisted", { value: false });
    window.dispatchEvent(pageShowEvent);

    expect(screen.getByLabelText("Company")).toBeDisabled();
  });

  test("carries sort and dir as hidden fields when set, omits them when absent", () => {
    const { rerender } = render(
      <VacancyFilterBar
        view="all"
        reasonFilter={null}
        q={null}
        company={null}
        from={null}
        to={null}
        status={null}
        companies={[]}
        hasActiveFilters={false}
        sort="status"
        dir="desc"
      />
    );
    let form = document.querySelector("form") as HTMLFormElement;
    expect(form.querySelector('input[name="sort"]')).toHaveValue("status");
    expect(form.querySelector('input[name="dir"]')).toHaveValue("desc");

    rerender(
      <VacancyFilterBar
        view="all"
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
    form = document.querySelector("form") as HTMLFormElement;
    expect(form.querySelector('input[name="sort"]')).not.toBeInTheDocument();
    expect(form.querySelector('input[name="dir"]')).not.toBeInTheDocument();
  });

  test("Clear filters href keeps the current sort and dir", () => {
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
        sort="title"
        dir="asc"
      />
    );
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/?view=todo&sort=title&dir=asc"
    );
  });

  test("clicking anywhere in From or To opens the native date picker", () => {
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

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    const toInput = screen.getByLabelText("To") as HTMLInputElement;
    const fromShowPicker = vi.fn();
    const toShowPicker = vi.fn();
    fromInput.showPicker = fromShowPicker;
    toInput.showPicker = toShowPicker;

    fireEvent.click(fromInput);
    fireEvent.click(toInput);

    expect(fromShowPicker).toHaveBeenCalledTimes(1);
    expect(toShowPicker).toHaveBeenCalledTimes(1);
  });

  test("does not throw when showPicker is unsupported", () => {
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

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    (fromInput as unknown as { showPicker?: unknown }).showPicker = undefined;

    expect(() => fireEvent.click(fromInput)).not.toThrow();
  });
});
