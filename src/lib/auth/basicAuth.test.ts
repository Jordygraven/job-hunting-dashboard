import { describe, expect, test } from "vitest";
import { isAuthorized } from "./basicAuth";

function basicHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

describe("isAuthorized", () => {
  test("accepts any username with the correct password", () => {
    expect(isAuthorized(basicHeader("anything", "secret123"), "secret123")).toBe(true);
    expect(isAuthorized(basicHeader("", "secret123"), "secret123")).toBe(true);
  });

  test("rejects the wrong password", () => {
    expect(isAuthorized(basicHeader("user", "wrong"), "secret123")).toBe(false);
  });

  test("rejects a missing authorization header", () => {
    expect(isAuthorized(null, "secret123")).toBe(false);
  });

  test("denies access when DASHBOARD_PASSWORD is unset", () => {
    expect(isAuthorized(basicHeader("user", "secret123"), undefined)).toBe(false);
    expect(isAuthorized(basicHeader("user", ""), "")).toBe(false);
  });
});
