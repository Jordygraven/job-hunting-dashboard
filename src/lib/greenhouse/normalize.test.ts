import { describe, expect, test } from "vitest";
import { normalizeJob } from "./normalize";

const board = { identifier: "bybit", displayName: "Bybit" };
const now = new Date("2026-10-14T00:00:00.000Z");

describe("normalizeJob", () => {
  test("maps every stored field", () => {
    const result = normalizeJob(
      { id: 123, title: "  Senior   Product \n Manager ", location: { name: " Kuala Lumpur " }, absolute_url: "https://x/y?gh_jid=123" },
      board,
      now
    );
    expect(result).toEqual({
      ok: true,
      row: {
        source: "greenhouse",
        source_job_id: "123",
        title: "Senior Product Manager",
        company: "Bybit",
        location: "Kuala Lumpur",
        url: "https://x/y?gh_jid=123",
        first_seen_at: "2026-10-14T00:00:00.000Z",
        source_message_id: null,
      },
    });
  });

  test("empty, missing or null location becomes null without crashing", () => {
    const base = { id: 1, title: "PM", absolute_url: "https://x" };
    for (const location of [{ name: "  " }, {}, null, undefined]) {
      const r = normalizeJob({ ...base, location }, board, now);
      expect(r.ok && r.row.location).toBeNull();
    }
  });

  test.each([
    [{ title: "PM", absolute_url: "https://x" }, null, "job missing id"],
    [{ id: 1, title: "   ", absolute_url: "https://x" }, "1", "job missing title"],
    [{ id: 1, title: "PM" }, "1", "job missing absolute_url"],
    [{}, null, "job missing id, title, absolute_url"],
  ])("invalid job %#", (job, jobId, reason) => {
    expect(normalizeJob(job, board, now)).toEqual({ ok: false, jobId, reason });
  });
});
