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

import { StarToggle } from "./StarToggle";

beforeEach(() => {
  starMock = vi.fn();
  unstarMock = vi.fn();
});

afterEach(() => {
  cleanup();
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
