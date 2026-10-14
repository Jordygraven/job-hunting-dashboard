// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SyncBadge } from "./SyncBadge";

afterEach(cleanup);

describe("SyncBadge", () => {
  test.each([
    ["ok", "OK", "text-status-success-fg"],
    ["warning", "Warning", "text-status-warning-fg"],
    ["error", "Error", "text-status-rejected-fg"],
  ] as const)("%s shows text label and its token", (status, label, cls) => {
    render(<SyncBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(cls);
  });
});
