// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

let autoDraftMock: any;
let pilotMock: any;

vi.mock("./actions", () => ({
  toggleAutoDraft: (...args: any[]) => autoDraftMock(...args),
  togglePilot: (...args: any[]) => pilotMock(...args),
}));

import { AutoDraftToggle, PilotToggle } from "./AutomationToggle";

beforeEach(() => {
  autoDraftMock = vi.fn();
  pilotMock = vi.fn();
});

afterEach(cleanup);

describe.each([
  {
    name: "AutoDraftToggle",
    Toggle: AutoDraftToggle,
    mark: "Mark for auto-draft",
    unmark: "Unmark auto-draft",
    mock: () => autoDraftMock,
  },
  { name: "PilotToggle", Toggle: PilotToggle, mark: "Mark as pilot", unmark: "Unmark pilot", mock: () => pilotMock },
])("$name", ({ Toggle, mark, unmark, mock }) => {
  test("label and aria-pressed flip with marked", () => {
    const { rerender } = render(<Toggle vacancyId={1} marked={false} />);
    expect(screen.getByRole("button", { name: mark })).toHaveAttribute("aria-pressed", "false");
    rerender(<Toggle vacancyId={1} marked={true} />);
    expect(screen.getByRole("button", { name: unmark })).toHaveAttribute("aria-pressed", "true");
  });

  test("click calls the action with the vacancy id and current marked state", async () => {
    mock().mockResolvedValue({ ok: true });
    render(<Toggle vacancyId={7} marked={true} />);
    fireEvent.click(screen.getByRole("button", { name: unmark }));
    await waitFor(() => expect(mock()).toHaveBeenCalledWith(7, true));
  });

  test("shows the returned error on ok:false", async () => {
    mock().mockResolvedValue({ ok: false, error: "Already drafted." });
    render(<Toggle vacancyId={1} marked={false} />);
    fireEvent.click(screen.getByRole("button", { name: mark }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Already drafted.");
  });

  test("shows a safe error when the action throws", async () => {
    mock().mockRejectedValue(new Error("boom"));
    render(<Toggle vacancyId={1} marked={false} />);
    fireEvent.click(screen.getByRole("button", { name: mark }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  test("is disabled while pending", async () => {
    let resolve!: (v: unknown) => void;
    mock().mockReturnValue(new Promise((r) => (resolve = r)));
    render(<Toggle vacancyId={1} marked={false} />);
    fireEvent.click(screen.getByRole("button", { name: mark }));
    await waitFor(() => expect(screen.getByRole("button", { name: mark })).toBeDisabled());
    resolve({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: mark })).toBeEnabled());
  });
});
