// src/lib/format/kualaLumpurTime.test.ts
import { describe, expect, test } from "vitest";
import { formatKlDate, formatKlDateTime } from "./kualaLumpurTime";

describe("formatKlDate", () => {
  test("formats a UTC morning timestamp as 'D Mon YYYY'", () => {
    expect(formatKlDate("2026-10-06T01:00:00.000Z")).toBe("6 Oct 2026");
  });

  test("renders the Kuala Lumpur date, not the UTC date, when they differ", () => {
    // 2026-10-05T20:00:00Z is 2026-10-06T04:00:00 in Asia/Kuala_Lumpur (UTC+8)
    expect(formatKlDate("2026-10-05T20:00:00.000Z")).toBe("6 Oct 2026");
  });
});

describe("formatKlDateTime", () => {
  test("includes the KL time alongside the KL date", () => {
    expect(formatKlDateTime("2026-10-05T20:00:00.000Z")).toBe("6 Oct 2026, 04:00");
  });
});
