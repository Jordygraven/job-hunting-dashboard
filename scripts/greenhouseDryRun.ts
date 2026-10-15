// Reads Greenhouse boards, filters, prints a report. Writes nothing, needs no secrets.
import { GREENHOUSE_BOARDS } from "../src/config/greenhouseBoards";
import { fetchBoardJobs } from "../src/lib/greenhouse/fetchBoard";
import { processBoard } from "../src/lib/greenhouse/processBoard";

const line = (r: { title: string; location: string | null; url: string }) =>
  `  ${r.title} | ${r.location ?? "-"} | ${r.url}`;

async function main() {
  const now = new Date();
  const start = Date.now();
  for (const board of GREENHOUSE_BOARDS) {
    console.log(`\n== ${board.displayName} (${board.identifier})`);
    try {
      const r = processBoard(await fetchBoardJobs(board), board, now);
      console.log(`total: ${r.total}, passing: ${r.passing.length}, invalid: ${r.invalid.length}`);
      console.log("first 5 passing:");
      r.passing.slice(0, 5).forEach((x) => console.log(line(x)));
      console.log(`title passes, location fails (${r.locationRejected.length}, first 5):`);
      r.locationRejected.slice(0, 5).forEach((x) => console.log(line(x)));
    } catch (error) {
      process.exitCode = 1;
      console.log(`FAILED: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  console.log(`\nelapsed: ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main();
