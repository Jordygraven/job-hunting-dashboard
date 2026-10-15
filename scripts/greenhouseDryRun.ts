// Reads Greenhouse boards, filters, prints a report. Writes nothing, needs no secrets.
import { readFileSync } from "node:fs";
import { fetchBoardJobs } from "../src/lib/greenhouse/fetchBoard";
import { processBoard } from "../src/lib/greenhouse/processBoard";

const CANDIDATES = "probe-output/boards-candidates.json";

const line = (r: { title: string; location: string | null; url: string }) =>
  `  ${r.title} | ${r.location ?? "-"} | ${r.url}`;

async function main() {
  let boards: { identifier: string; displayName: string }[];
  try {
    boards = JSON.parse(readFileSync(CANDIDATES, "utf8")).map(
      (b: { identifier: string; displayName: string }) => ({
        identifier: b.identifier,
        displayName: b.displayName,
      }),
    );
  } catch {
    console.log(`Cannot read ${CANDIDATES}. Run: node scripts/importBoards.mjs`);
    process.exitCode = 1;
    return;
  }
  const now = new Date();
  const start = Date.now();
  let failed = 0;
  for (const board of boards) {
    console.log(`\n== ${board.displayName} (${board.identifier})`);
    try {
      const r = processBoard(await fetchBoardJobs(board), board, now);
      console.log(`total: ${r.total}, passing: ${r.passing.length}, invalid: ${r.invalid.length}`);
      console.log("first 5 passing:");
      r.passing.slice(0, 5).forEach((x) => console.log(line(x)));
      console.log(`title passes, location fails (${r.locationRejected.length}, first 5):`);
      r.locationRejected.slice(0, 5).forEach((x) => console.log(line(x)));
    } catch (error) {
      failed++;
      process.exitCode = 1;
      console.log(`FAILED: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  console.log(`\nelapsed: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(`boards read: ${boards.length}, failed: ${failed}`);
}

main();
