import { describe, expect, test } from "vitest";
import { ALL_ACTIONS } from "./types";

describe("ALL_ACTIONS", () => {
  test("is exactly the twelve action values", () => {
    expect([...ALL_ACTIONS]).toEqual([
      "applied",
      "ignored",
      "reset",
      "rejected",
      "success",
      "starred",
      "unstarred",
      "automated_draft",
      "automated_draft_cleared",
      "automated_draft_done",
      "pilot",
      "pilot_cleared",
    ]);
  });
});
