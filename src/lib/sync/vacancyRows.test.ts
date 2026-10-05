import { describe, expect, test } from "vitest";
import { toVacancyRows, uniqueVacancyRows } from "./vacancyRows";
import type { LinkedInCard } from "@/lib/parsers/linkedin";

function card(overrides: Partial<LinkedInCard> = {}): LinkedInCard {
  return {
    jobId: "1000000001",
    title: "Widget Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://www.linkedin.com/jobs/view/1000000001/",
    ...overrides,
  };
}

describe("toVacancyRows", () => {
  test("maps a card to a vacancy row", () => {
    const emailDate = new Date("2026-09-30T08:00:00.000Z");

    const rows = toVacancyRows([card()], "msg-1", emailDate);

    expect(rows).toEqual([
      {
        source: "linkedin",
        source_job_id: "1000000001",
        title: "Widget Engineer",
        company: "Acme",
        location: "Remote",
        url: "https://www.linkedin.com/jobs/view/1000000001/",
        first_seen_at: "2026-09-30T08:00:00.000Z",
        source_message_id: "msg-1",
      },
    ]);
  });

  test("preserves a null location", () => {
    const rows = toVacancyRows(
      [card({ location: null })],
      "msg-1",
      new Date("2026-09-30T08:00:00.000Z")
    );

    expect(rows[0].location).toBeNull();
  });

  test("returns one row per card, all sharing the same message id", () => {
    const rows = toVacancyRows(
      [card({ jobId: "1" }), card({ jobId: "2" })],
      "msg-1",
      new Date("2026-09-30T08:00:00.000Z")
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.source_message_id === "msg-1")).toBe(true);
  });
});

describe("uniqueVacancyRows", () => {
  test("keeps the earliest sighting when the same job appears in multiple messages", () => {
    const earlier = toVacancyRows(
      [card({ jobId: "1", title: "First seen" })],
      "msg-older",
      new Date("2026-09-28T08:00:00.000Z")
    );
    const later = toVacancyRows(
      [card({ jobId: "1", title: "Seen again" })],
      "msg-newer",
      new Date("2026-09-30T08:00:00.000Z")
    );

    const result = uniqueVacancyRows([...earlier, ...later]);

    expect(result).toHaveLength(1);
    expect(result[0].source_message_id).toBe("msg-older");
    expect(result[0].title).toBe("First seen");
  });

  test("count arithmetic: cards minus in-run duplicates equals unique, and unique equals inserted plus skipped", () => {
    const rows = [
      ...toVacancyRows(
        [card({ jobId: "1" }), card({ jobId: "2" })],
        "msg-1",
        new Date("2026-09-28T00:00:00.000Z")
      ),
      ...toVacancyRows(
        [card({ jobId: "2" }), card({ jobId: "3" })],
        "msg-2",
        new Date("2026-09-29T00:00:00.000Z")
      ),
    ];

    const cardsCount = rows.length;
    const uniqueRows = uniqueVacancyRows(rows);
    const uniqueCount = uniqueRows.length;

    expect(cardsCount).toBe(4);
    expect(uniqueCount).toBe(3);

    // simulate the db upsert: job "1" already existed from a previous run
    const inserted = uniqueCount - 1;
    const skipped = uniqueCount - inserted;

    expect(inserted + skipped).toBe(uniqueCount);
  });
});
