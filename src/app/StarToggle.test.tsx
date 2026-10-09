// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

let starMock: any;
let unstarMock: any;

vi.mock("./actions", () => ({
  star: (...args: any[]) => starMock(...args),
  unstar: (...args: any[]) => unstarMock(...args),
}));

import { consumePendingScrollRestore, scheduleScrollRestore, StarToggle } from "./StarToggle";

beforeEach(() => {
  starMock = vi.fn();
  unstarMock = vi.fn();
  // jsdom doesn't implement scrollTo; every toggle's layout effect calls it.
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StarToggle — interactive (To do rows, or any row on the Interest tab)", () => {
  test("not starred shows a Star button", () => {
    render(<StarToggle vacancyId={1} starred={false} interactive={true} />);
    expect(screen.getByRole("button", { name: "Star" })).toBeInTheDocument();
  });

  test("starred shows an Unstar button, not a static glyph", () => {
    render(<StarToggle vacancyId={1} starred={true} interactive={true} />);
    expect(screen.getByRole("button", { name: "Unstar" })).toBeInTheDocument();
  });

  test("clicking Star calls star with the vacancy id", async () => {
    starMock.mockResolvedValue({ ok: true });
    render(<StarToggle vacancyId={7} starred={false} interactive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Star" }));
    await waitFor(() => expect(starMock).toHaveBeenCalledWith(7));
    expect(unstarMock).not.toHaveBeenCalled();
  });

  test("clicking Unstar calls unstar with the vacancy id — this is how the Interest tab unstars regardless of status", async () => {
    unstarMock.mockResolvedValue({ ok: true });
    render(<StarToggle vacancyId={7} starred={true} interactive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Unstar" }));
    await waitFor(() => expect(unstarMock).toHaveBeenCalledWith(7));
    expect(starMock).not.toHaveBeenCalled();
  });

  test("shows the server's error message on failure", async () => {
    starMock.mockResolvedValue({ ok: false, error: "Can only star a To do vacancy." });
    render(<StarToggle vacancyId={7} starred={false} interactive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Star" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Can only star a To do vacancy.")
    );
  });
});

describe("StarToggle — non-interactive (every other row on every other tab)", () => {
  test("starred renders a static glyph, no button", () => {
    render(<StarToggle vacancyId={1} starred={true} interactive={false} />);
    expect(screen.getByLabelText("Starred")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("unstarred renders nothing", () => {
    const { container } = render(<StarToggle vacancyId={1} starred={false} interactive={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// Starring/unstarring reorders the table (starred rows sort first by
// default), which otherwise relocates the clicked row away from the page's
// current scroll position. See StarToggle.tsx for the full explanation.
describe("scheduleScrollRestore / consumePendingScrollRestore — the scroll-restore queue", () => {
  afterEach(() => {
    consumePendingScrollRestore(); // drain in case a test below left it set
  });

  test("consuming returns the scheduled value", () => {
    scheduleScrollRestore(240);
    expect(consumePendingScrollRestore()).toBe(240);
  });

  test("consuming clears it — a second consume returns null", () => {
    scheduleScrollRestore(100);
    consumePendingScrollRestore();
    expect(consumePendingScrollRestore()).toBeNull();
  });

  test("consuming with nothing scheduled returns null", () => {
    expect(consumePendingScrollRestore()).toBeNull();
  });
});

describe("StarToggle — scroll position", () => {
  test("restores the pre-click scroll position after a successful toggle", async () => {
    starMock.mockResolvedValue({ ok: true });
    Object.defineProperty(window, "scrollY", { value: 850, configurable: true });

    render(<StarToggle vacancyId={7} starred={false} interactive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Star" }));

    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 850));
  });

  test("does not touch scroll position when the server rejects the toggle", async () => {
    starMock.mockResolvedValue({ ok: false, error: "Can only star a To do vacancy." });

    render(<StarToggle vacancyId={7} starred={false} interactive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Star" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
