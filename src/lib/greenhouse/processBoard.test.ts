import { expect, test } from "vitest";
import { processBoard } from "./processBoard";

const board = { identifier: "bybit", displayName: "Bybit" };

test("splits jobs into passing, location-rejected and invalid", () => {
  const jobs = [
    { id: 1, title: "Product Manager", location: { name: "Kuala Lumpur" }, absolute_url: "https://a" },
    { id: 2, title: "Product Manager", location: { name: "Dubai" }, absolute_url: "https://b" },
    { id: 3, title: "Software Engineer", location: { name: "Kuala Lumpur" }, absolute_url: "https://c" },
    { id: 4, title: "Product Owner", absolute_url: "https://d" },
    { title: "Product Owner", absolute_url: "https://e" },
  ];
  const r = processBoard(jobs, board, new Date());
  expect(r.total).toBe(5);
  expect(r.passing.map((x) => x.source_job_id)).toEqual(["1"]);
  expect(r.locationRejected.map((x) => x.source_job_id)).toEqual(["2", "4"]);
  expect(r.invalid).toEqual([{ jobId: null, reason: "job missing id" }]);
});
