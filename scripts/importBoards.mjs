import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DROP_COMPANIES = ["remote.com", "wiz.ai", "gate.io"];

// RFC 4180: quoted fields may hold commas, newlines and doubled quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...data] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export function selectBoards(rows) {
  const dropped = { notGreenhouse: 0, noJobs: 0, notOk: 0, namedCompany: 0, duplicate: 0 };
  const seen = new Set();
  const kept = [];
  for (const r of rows) {
    if (r.portal !== "greenhouse") dropped.notGreenhouse++;
    else if (!(Number(r.total_jobs) >= 1)) dropped.noJobs++;
    else if (r.match_check !== "ok") dropped.notOk++;
    else if (DROP_COMPANIES.includes(r.company.toLowerCase())) dropped.namedCompany++;
    else if (seen.has(r.slug)) dropped.duplicate++;
    else {
      seen.add(r.slug);
      kept.push({ portal: "greenhouse", identifier: r.slug, displayName: r.company, jobCount: Number(r.total_jobs) });
    }
  }
  return { kept, dropped };
}

const sqlText = (s) => `'${s.replace(/'/g, "''")}'`;

// One statement per board: `on conflict do nothing` returns no id for an existing board, so it gets no check row.
export function toSql(boards) {
  const statements = boards.map(
    (b) => `with b as (
  insert into public.boards (portal, identifier, display_name)
  values (${sqlText(b.portal)}, ${sqlText(b.identifier)}, ${sqlText(b.displayName)}) on conflict do nothing returning id
)
insert into public.board_checks (board_id, status, job_count)
select id, 'active', ${b.jobCount} from b;
`,
  );
  return statements.join("\n") + "\nselect count(*) from public.boards;\n";
}

function main() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "probe-output");
  const { kept, dropped } = selectBoards(parseCsv(fs.readFileSync(path.join(dir, "boards-found.csv"), "utf8")));
  fs.writeFileSync(path.join(dir, "boards-candidates.json"), JSON.stringify(kept, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "boards-import.sql"), toSql(kept));
  console.log(`kept ${kept.length}`);
  for (const [reason, n] of Object.entries(dropped)) console.log(`dropped ${reason}: ${n}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
