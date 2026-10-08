import { describe, expect, test } from "vitest";
import { config } from "./proxy";

// Next.js compiles each matcher entry as an anchored regex against the path;
// replicate that here so the test exercises the real exported pattern.
function matches(path: string): boolean {
  return new RegExp(`^${config.matcher[0]}$`).test(path);
}

describe("proxy matcher", () => {
  test("excludes /api/sync and its subpaths from the auth gate", () => {
    expect(matches("/api/sync")).toBe(false);
    expect(matches("/api/sync/")).toBe(false);
  });

  test("still gates ordinary routes, including similarly-named ones", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/vacancies")).toBe(true);
    expect(matches("/api/syncthing")).toBe(true);
  });

  test("excludes exactly /privacy from the auth gate", () => {
    expect(matches("/privacy")).toBe(false);
  });

  test("still gates /privacy subpaths and lookalikes", () => {
    expect(matches("/privacy/anything")).toBe(true);
    expect(matches("/privacyx")).toBe(true);
  });

  test("excludes Next.js static assets and the favicon", () => {
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });
});
