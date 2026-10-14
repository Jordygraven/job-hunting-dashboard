// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SyncsPagination } from "./SyncsPagination";

afterEach(cleanup);

describe("SyncsPagination", () => {
  test("first page: Next only", () => {
    render(<SyncsPagination page={1} totalPages={3} />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/syncs?page=2");
  });

  test("last page: Previous only", () => {
    render(<SyncsPagination page={3} totalPages={3} />);
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/syncs?page=2");
  });

  test("single page: no links", () => {
    render(<SyncsPagination page={1} totalPages={1} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
