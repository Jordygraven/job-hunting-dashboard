// src/app/VacancyActions.test.tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

let applyMock: any;
let ignoreMock: any;
let undoMock: any;
let editAppliedDateMock: any;

vi.mock("./actions", () => ({
  apply: (...args: any[]) => applyMock(...args),
  ignore: (...args: any[]) => ignoreMock(...args),
  undo: (...args: any[]) => undoMock(...args),
  editAppliedDate: (...args: any[]) => editAppliedDateMock(...args),
}));

import { VacancyActions } from "./VacancyActions";

beforeEach(() => {
  applyMock = vi.fn();
  ignoreMock = vi.fn();
  undoMock = vi.fn();
  editAppliedDateMock = vi.fn();
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
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "interest" } });
    await waitFor(() => expect(ignoreMock).toHaveBeenCalledWith(7, "interest"));
  });

  test("resets the select to the placeholder after a failed ignore action", async () => {
    ignoreMock.mockResolvedValue({ ok: false, error: "Already marked as ignored." });
    render(<VacancyActions vacancyId={7} status="todo" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "interest" } });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Already marked as ignored.")
    );
    expect(screen.getByRole("combobox")).toHaveValue("");
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

describe("VacancyActions — Edit date button visibility", () => {
  test("applied rows show an Edit date button", () => {
    render(<VacancyActions vacancyId={1} status="applied" appliedOn="2026-10-01" />);
    expect(screen.getByRole("button", { name: "Edit date" })).toBeInTheDocument();
  });

  test("todo rows do not show Edit date", () => {
    render(<VacancyActions vacancyId={1} status="todo" />);
    expect(screen.queryByRole("button", { name: "Edit date" })).not.toBeInTheDocument();
  });

  test("ignored rows do not show Edit date", () => {
    render(<VacancyActions vacancyId={1} status="ignored" />);
    expect(screen.queryByRole("button", { name: "Edit date" })).not.toBeInTheDocument();
  });
});

describe("VacancyActions — editing the applied date", () => {
  test("Edit date opens a date input prefilled with the current applied date, with Save disabled", () => {
    render(<VacancyActions vacancyId={1} status="applied" appliedOn="2026-10-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit date" }));
    expect(screen.getByLabelText("Applied on")).toHaveValue("2026-10-01");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("changing the date enables Save", () => {
    render(<VacancyActions vacancyId={1} status="applied" appliedOn="2026-10-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit date" }));
    fireEvent.change(screen.getByLabelText("Applied on"), { target: { value: "2026-10-02" } });
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  test("Cancel closes the editor and changes nothing", () => {
    render(<VacancyActions vacancyId={1} status="applied" appliedOn="2026-10-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit date" }));
    fireEvent.change(screen.getByLabelText("Applied on"), { target: { value: "2026-10-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Applied on")).not.toBeInTheDocument();
    expect(editAppliedDateMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit date" })).toBeInTheDocument();
  });

  test("Save calls editAppliedDate and closes the editor on success", async () => {
    editAppliedDateMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="applied" appliedOn="2026-10-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit date" }));
    fireEvent.change(screen.getByLabelText("Applied on"), { target: { value: "2026-10-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editAppliedDateMock).toHaveBeenCalledWith(7, "2026-10-02"));
    await waitFor(() => expect(screen.queryByLabelText("Applied on")).not.toBeInTheDocument());
  });

  test("Save shows the safe error message and keeps the editor open on failure", async () => {
    editAppliedDateMock.mockResolvedValue({ ok: false, error: "Invalid date." });
    render(<VacancyActions vacancyId={7} status="applied" appliedOn="2026-10-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit date" }));
    fireEvent.change(screen.getByLabelText("Applied on"), { target: { value: "2026-10-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.")
    );
    expect(screen.getByLabelText("Applied on")).toBeInTheDocument();
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
