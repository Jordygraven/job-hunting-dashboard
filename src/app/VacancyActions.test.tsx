// src/app/VacancyActions.test.tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

let applyMock: any;
let ignoreMock: any;
let undoMock: any;

vi.mock("./actions", () => ({
  apply: (...args: any[]) => applyMock(...args),
  ignore: (...args: any[]) => ignoreMock(...args),
  undo: (...args: any[]) => undoMock(...args),
}));

import { VacancyActions } from "./VacancyActions";

beforeEach(() => {
  applyMock = vi.fn();
  ignoreMock = vi.fn();
  undoMock = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("VacancyActions — button sets per status", () => {
  test("todo shows Applied, Ignore, and the ignore-with-reason select", () => {
    render(<VacancyActions vacancyId={1} status="todo" />);
    expect(screen.getByRole("button", { name: "Applied" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  test("applied shows Ignore, the ignore-with-reason select, and Undo", () => {
    render(<VacancyActions vacancyId={1} status="applied" />);
    expect(screen.getByRole("button", { name: "Ignore" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Applied" })).not.toBeInTheDocument();
  });

  test("ignored shows only Undo", () => {
    render(<VacancyActions vacancyId={1} status="ignored" />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ignore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("VacancyActions — clicking buttons", () => {
  test("Applied calls apply with the vacancy id", async () => {
    applyMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="todo" />);
    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    await waitFor(() => expect(applyMock).toHaveBeenCalledWith(7));
  });

  test("Ignore calls ignore with no reason", async () => {
    ignoreMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="todo" />);
    fireEvent.click(screen.getByRole("button", { name: "Ignore" }));
    await waitFor(() => expect(ignoreMock).toHaveBeenCalledWith(7));
  });

  test("picking a reason in the select calls ignore with that reason", async () => {
    ignoreMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="todo" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "location" } });
    await waitFor(() => expect(ignoreMock).toHaveBeenCalledWith(7, "location"));
  });

  test("Undo calls undo with the vacancy id", async () => {
    undoMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="ignored" />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(undoMock).toHaveBeenCalledWith(7));
  });
});

describe("VacancyActions — pending state", () => {
  test("disables this row's buttons while a click is pending, then re-enables them", async () => {
    let resolveApply!: (value: { ok: true }) => void;
    applyMock.mockReturnValue(new Promise((resolve) => (resolveApply = resolve)));
    render(<VacancyActions vacancyId={1} status="todo" />);

    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    expect(screen.getByRole("button", { name: "Applied" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeDisabled();

    resolveApply({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Applied" })).not.toBeDisabled());
  });

  test("a second click while pending does not call the Server Action twice", async () => {
    let resolveApply!: (value: { ok: true }) => void;
    applyMock.mockReturnValue(new Promise((resolve) => (resolveApply = resolve)));
    render(<VacancyActions vacancyId={1} status="todo" />);

    const button = screen.getByRole("button", { name: "Applied" });
    fireEvent.click(button);
    fireEvent.click(button);

    resolveApply({ ok: true });
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  test("re-enables the buttons after a failed action, not only after success", async () => {
    applyMock.mockResolvedValue({ ok: false, error: "Already marked as applied." });
    render(<VacancyActions vacancyId={1} status="todo" />);

    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Applied" })).not.toBeDisabled()
    );
  });
});

describe("VacancyActions — error paths", () => {
  test("shows the safe message from a resolved {ok:false} result", async () => {
    applyMock.mockResolvedValue({ ok: false, error: "Already marked as applied." });
    render(<VacancyActions vacancyId={1} status="todo" />);
    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Already marked as applied.")
    );
  });

  test("shows a generic message when the action promise rejects, never the raw error", async () => {
    applyMock.mockRejectedValue(new Error("fetch failed: ECONNRESET"));
    render(<VacancyActions vacancyId={1} status="todo" />);
    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.")
    );
    expect(screen.queryByText(/ECONNRESET/)).not.toBeInTheDocument();
  });
});
