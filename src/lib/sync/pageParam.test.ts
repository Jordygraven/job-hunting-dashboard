import { describe, expect, test } from "vitest";
import { clampPage } from "./pageParam";

describe("clampPage", () => {
  test.each([
    [undefined, 4, 1],
    ["2", 4, 2],
    ["0", 4, 1],
    ["-3", 4, 1],
    ["abc", 4, 1],
    ["2.5", 4, 1],
    ["999", 4, 4],
    ["3", 0, 1],
  ])("%s of %i gives %i", (raw, total, expected) => {
    expect(clampPage(raw, total)).toBe(expected);
  });
  test("uses the first of repeated params", () => {
    expect(clampPage(["3", "1"], 4)).toBe(3);
  });
});
