#!/usr/bin/env node
// Board probe. For each company in a list, guess its job board name and check
// Greenhouse, Lever, Ashby and Breezy. Then count the jobs that pass the owner's title and
// location rules. Read-only: it never writes to Supabase and never runs in the cron.
//
// Usage (from the repo root):
//   node scripts/board-probe.mjs                       (uses scripts/board-probe-companies.txt)
//   node scripts/board-probe.mjs --limit 20            (first 20 companies only, good first test)
//   node scripts/board-probe.mjs my-list.txt --concurrency 4 --delay 250 --lever-eu
//
// Output goes to probe-output/ in the folder you run it from.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Filter rules. COPIED BY HAND from src/config/greenhouseFilter.ts.
// If you change that file, change these too.
// ---------------------------------------------------------------------------

export const INCLUDE_TITLE_TERMS = [
  "AI Consultant",
  "GenAI Product Manager",
  "Agentic AI",
  "AI Automation",
  "AI Product Manager",
  "AI Specialist",
  "Product Lead",
  "Product Owner",
  "Product Manager",
];

export const EXCLUDE_TITLE_TERMS = [
  "Head of",
  "Director",
  "VP",
  "Vice President",
  "Chief",
  "Junior",
  "Intern",
  "Internship",
];

export const LOCATION_FAIL_TERMS = ["klang", "penang", "johor", "sarawak"];

export const LOCATION_PLACE_TERMS = [
  "kuala lumpur",
  "selangor",
  "petaling jaya",
  "cyberjaya",
  "putrajaya",
  "shah alam",
  "subang",
  "bangsar",
  "mont kiara",
  "cheras",
  "ampang jaya",
  "bukit jalil",
  "puchong",
];

export const LOCATION_EXACT = "malaysia";

export const LOCATION_REMOTE_REGION_TERMS = ["malaysia", "apac", "southeast asia"];

// ---------------------------------------------------------------------------
// Filter functions
// ---------------------------------------------------------------------------

const regexCache = new Map();

function wordRegex(term) {
  let re = regexCache.get(term);
  if (!re) {
    const escaped = term
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);
    regexCache.set(term, re);
  }
  return re;
}

// Whole-word, case-insensitive match. "intern" does not match "International".
export function hasWord(text, term) {
  return wordRegex(term).test(String(text).toLowerCase());
}

export function titlePasses(title) {
  const t = String(title ?? "").trim();
  if (!t) return false;
  if (!INCLUDE_TITLE_TERMS.some((term) => hasWord(t, term))) return false;
  if (EXCLUDE_TITLE_TERMS.some((term) => hasWord(t, term))) return false;
  return true;
}

function locationPartPasses(part) {
  const p = part.trim().toLowerCase();
  if (!p) return false;
  if (LOCATION_FAIL_TERMS.some((term) => hasWord(p, term))) return false; // fail beats pass
  if (p === LOCATION_EXACT) return true;
  if (LOCATION_PLACE_TERMS.some((term) => hasWord(p, term))) return true;
  if (hasWord(p, "remote") && LOCATION_REMOTE_REGION_TERMS.some((term) => hasWord(p, term))) {
    return true;
  }
  return false;
}

// `locations` is a list of free-text strings. Each one splits on ";" and any part may pass.
export function locationPasses(locations) {
  const parts = locations.flatMap((l) => String(l ?? "").split(";"));
  return parts.some(locationPartPasses);
}

export function jobPasses(job) {
  return titlePasses(job.title) && locationPasses(job.locations);
}

// ---------------------------------------------------------------------------
// Guessing board names ("slugs") from a company name
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "sdn", "bhd", "berhad", "pte", "ltd", "limited", "inc", "llc", "corp", "corporation",
  "co", "group", "holdings", "holding", "international", "malaysia", "apac", "asia",
  "m", "plc", "gmbh", "sa", "ag",
]);

export function clean(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function domainLabel(domain) {
  if (!domain) return null;
  const host = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return host.split(".")[0] || null;
}

// Returns up to 6 board names to try, most likely first.
export function slugVariants(aliases, domain) {
  const out = [];
  const add = (s) => {
    if (s && /^[a-z0-9][a-z0-9-]{1,59}$/.test(s) && !out.includes(s)) out.push(s);
  };
  const wordLists = aliases.map((a) => clean(a).split(" ").filter(Boolean));
  const cores = wordLists.map((w) => {
    const core = w.filter((x) => !STOP_WORDS.has(x));
    return core.length ? core : w;
  });

  for (const core of cores) add(core.join(""));
  for (const core of cores) add(core.join("-"));
  // A name that is itself a web address, like "Pand.ai", also gets its first part ("pand").
  for (const alias of aliases) {
    if (/^[A-Za-z0-9-]+\.[A-Za-z]{2,}$/.test(alias.trim())) add(alias.trim().split(".")[0].toLowerCase());
  }
  add(domainLabel(domain));
  for (const w of wordLists) add(w.join("")); // full name, e.g. "aiamalaysia"
  if (cores[0]) add(cores[0].join("") + "boards"); // e.g. "firstdigitaltrustboards"
  return out.slice(0, 6);
}

function nameKeys(aliases) {
  const keys = new Set();
  for (const a of aliases) {
    const words = clean(a).split(" ").filter(Boolean);
    const core = words.filter((x) => !STOP_WORDS.has(x));
    keys.add(words.join(""));
    keys.add((core.length ? core : words).join(""));
  }
  return [...keys].filter((k) => k.length >= 3);
}

// Does the name the board reports look like our company?
// Short names (under 5 letters) are risky, so they must equal the board's first word.
export function nameMatches(aliases, boardName) {
  if (!boardName) return false;
  const words = clean(boardName).split(" ").filter(Boolean);
  const b = words.join("");
  if (b.length < 3) return false;
  return nameKeys(aliases).some((k) =>
    k.length >= 5 ? b.includes(k) || (b.length >= 5 && k.includes(b)) : words[0] === k || b === k
  );
}

// ---------------------------------------------------------------------------
// The three portals. Each one knows its web address and how to read the reply.
// A reply that does not look right returns null, which counts as "no board".
// ---------------------------------------------------------------------------

const PORTALS = {
  greenhouse: {
    hosts: () => ["https://boards-api.greenhouse.io"],
    url: (host, slug) => `${host}/v1/boards/${slug}/jobs`,
    // Checked against a real reply (also works for EU boards).
    parse: (data) =>
      Array.isArray(data?.jobs)
        ? {
            boardName: data.jobs.find((j) => j.company_name)?.company_name ?? null,
            jobs: data.jobs.map((j) => ({
              title: j.title,
              locations: [j.location?.name ?? ""],
              url: j.absolute_url,
            })),
          }
        : null,
  },
  lever: {
    hosts: (opts) =>
      opts.leverEu
        ? ["https://api.lever.co", "https://api.eu.lever.co"]
        : ["https://api.lever.co"],
    url: (host, slug) => `${host}/v0/postings/${slug}?mode=json`,
    // Not yet checked against a real reply. Reads the usual Lever fields.
    parse: (data) =>
      Array.isArray(data)
        ? {
            boardName: null,
            jobs: data.map((j) => ({
              title: j.text,
              locations: [...(j.categories?.allLocations ?? []), j.categories?.location ?? ""],
              url: j.hostedUrl,
            })),
          }
        : null,
  },
  ashby: {
    hosts: () => ["https://api.ashbyhq.com"],
    url: (host, slug) => `${host}/posting-api/job-board/${slug}`,
    // Not yet checked against a real reply. Reads the usual Ashby fields.
    parse: (data) =>
      Array.isArray(data?.jobs)
        ? {
            boardName: null,
            jobs: data.jobs
              .filter((j) => j.isListed !== false)
              .map((j) => ({
                title: j.title,
                locations: [
                  j.location ?? "",
                  ...(j.secondaryLocations ?? []).map((x) => (typeof x === "string" ? x : x?.location ?? "")),
                ],
                url: j.jobUrl,
              })),
          }
        : null,
  },
  breezy: {
    // Every Breezy company has its own subdomain, so the slug goes in the host name.
    // A subdomain that does not exist fails at the network level, which means "no board".
    hosts: () => [""],
    url: (_host, slug) => `https://${slug}.breezy.hr/json`,
    dnsMissMeansNoBoard: true,
    // Checked against a real reply (a live Breezy board on 15 Oct 2026).
    parse: (data) =>
      Array.isArray(data)
        ? {
            boardName: data.find((j) => j?.company?.name)?.company?.name ?? null,
            jobs: data.map((j) => ({
              title: j.name,
              locations: [j.location?.name ?? "", ...(j.locations ?? []).map((l) => l?.name ?? "")],
              url: j.url,
            })),
          }
        : null,
  },
};

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const stats = { requests: 0, hits: 0, notFound: 0, other: 0, retried: 0, lastOtherStatus: null };

// Returns { status: 200, data } | { status: 404 } | { status: <other> } | { status: 0 } (network failure).
export async function getJson(url, { retries = 3, timeoutMs = 15000, delayMs = 0, dnsMiss = false } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (delayMs) await sleep(delayMs);
    let timer;
    try {
      const ctrl = new AbortController();
      timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          accept: "application/json",
          "user-agent": "job-hunting-dashboard-board-probe (personal project)",
        },
      });
      clearTimeout(timer);
      if (res.status === 404) return { status: 404 };
      if (res.status === 429 || res.status >= 500) {
        stats.retried++;
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) return { status: res.status };
      try {
        return { status: 200, data: await res.json() };
      } catch {
        return { status: 404 }; // a reply that is not JSON means there is no board here
      }
    } catch (e) {
      clearTimeout(timer);
      // A subdomain that does not exist (Breezy) fails DNS. That means "no board", not "network down".
      if (dnsMiss && e?.cause?.code === "ENOTFOUND") return { status: 404 };
      // Network failure or timeout: retry once, then give up on this request.
      stats.retried++;
      if (attempt >= 1) break;
      await sleep(1000);
    }
  }
  return { status: 0 };
}

function record(status) {
  stats.requests++;
  if (status === 200) stats.hits++;
  else if (status === 404) stats.notFound++;
  else {
    stats.other++;
    stats.lastOtherStatus = status;
  }
  // If the first 12 requests are all neither 200 nor 404, something blocks us. Stop early.
  if (stats.requests === 12 && stats.hits === 0 && stats.notFound === 0) {
    throw new Error(
      `The first 12 requests all failed (last status ${stats.lastOtherStatus}). ` +
        "Your network, VPN or a firewall may be blocking the job board APIs. No results were collected."
    );
  }
}

// ---------------------------------------------------------------------------
// Probing one company
// ---------------------------------------------------------------------------

export async function probeCompany(company, opts = {}) {
  const slugs = slugVariants(company.aliases, company.domain);
  const primary = new Set([slugs[0], slugs[1], domainLabel(company.domain)].filter(Boolean));
  const boards = [];

  for (const [portalName, portal] of Object.entries(PORTALS)) {
    let found = null;
    for (const slug of slugs) {
      for (const host of portal.hosts(opts)) {
        const r = await getJson(portal.url(host, slug), {
          delayMs: opts.delayMs ?? 0,
          dnsMiss: portal.dnsMissMeansNoBoard === true,
        });
        record(r.status);
        if (r.status !== 200) continue;
        const parsed = portal.parse(r.data);
        if (!parsed) continue;
        found = { slug, ...parsed };
        break;
      }
      if (found) break;
    }
    if (!found) continue;

    const matching = found.jobs.filter(jobPasses);
    const matchCheck = found.boardName
      ? nameMatches(company.aliases, found.boardName) ? "ok" : "check"
      : primary.has(found.slug) ? "ok" : "check";
    boards.push({
      company: company.name,
      source: company.source,
      portal: portalName,
      slug: found.slug,
      boardName: found.boardName ?? "",
      matchCheck,
      totalJobs: found.jobs.length,
      matching,
    });
  }
  return boards;
}

// ---------------------------------------------------------------------------
// Company list
// ---------------------------------------------------------------------------

export function parseCompanies(text) {
  let source = "unknown";
  const seen = new Set();
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const m = line.match(/^#\s*source:\s*(.+)$/i);
      if (m) source = m[1].trim();
      continue;
    }
    const [namePart, domainPart] = line.split(" @ ");
    const aliases = namePart.split("|").map((s) => s.trim()).filter(Boolean);
    if (!aliases.length) continue;
    const key = clean(aliases[0]);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: aliases[0], aliases, domain: domainPart?.trim() || null, source });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvLine = (cells) => cells.map(csvCell).join(",") + "\n";

async function runPool(items, size, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        await fn(items[i], i);
      }
    })
  );
}

function parseArgs(argv) {
  const opts = { file: null, limit: Infinity, concurrency: 4, delayMs: 250, leverEu: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") opts.limit = Number(argv[++i]);
    else if (a === "--concurrency") opts.concurrency = Number(argv[++i]);
    else if (a === "--delay") opts.delayMs = Number(argv[++i]);
    else if (a === "--lever-eu") opts.leverEu = true;
    else if (!a.startsWith("--") && !opts.file) opts.file = a;
    else throw new Error(`Unknown option: ${a}`);
  }
  for (const k of ["limit", "concurrency", "delayMs"]) {
    if (Number.isNaN(opts[k]) || opts[k] < 0) throw new Error(`Bad value for ${k}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = opts.file ?? path.join(here, "board-probe-companies.txt");
  const companies = parseCompanies(fs.readFileSync(file, "utf8")).slice(0, opts.limit);
  console.log(`Probing ${companies.length} companies on Greenhouse, Lever, Ashby and Breezy.`);
  console.log(`Concurrency ${opts.concurrency}, ${opts.delayMs} ms pause per request.\n`);

  const outDir = path.resolve("probe-output");
  fs.mkdirSync(outDir, { recursive: true });
  const boardsFile = path.join(outDir, "boards-found.csv");
  const jobsFile = path.join(outDir, "matching-jobs.csv");
  fs.writeFileSync(boardsFile, csvLine(["company", "source", "portal", "slug", "board_name", "match_check", "total_jobs", "matching_jobs"]));
  fs.writeFileSync(jobsFile, csvLine(["company", "portal", "title", "location", "url"]));

  const all = [];
  const notFound = [];
  let done = 0;

  await runPool(companies, opts.concurrency, async (company) => {
    const boards = await probeCompany(company, opts);
    done++;
    if (!boards.length) notFound.push(company.name);
    for (const b of boards) {
      all.push(b);
      fs.appendFileSync(
        boardsFile,
        csvLine([b.company, b.source, b.portal, b.slug, b.boardName, b.matchCheck, b.totalJobs, b.matching.length])
      );
      for (const j of b.matching) {
        fs.appendFileSync(jobsFile, csvLine([b.company, b.portal, j.title, [...new Set(j.locations.filter(Boolean))].join("; "), j.url]));
      }
    }
    if (done % 10 === 0 || done === companies.length) {
      console.log(`[${done}/${companies.length}] boards found so far: ${all.length}`);
    }
  });

  fs.writeFileSync(path.join(outDir, "not-found.txt"), notFound.sort().join("\n") + "\n");

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Companies checked: ${companies.length}`);
  console.log(`Companies with at least one board: ${companies.length - notFound.length}`);
  console.log(`Requests: ${stats.requests} (200: ${stats.hits}, 404: ${stats.notFound}, other: ${stats.other}, retries: ${stats.retried})\n`);
  const rate = (hit, total) => (total ? `${((hit / total) * 100).toFixed(1)}%` : "n/a");
  console.log("Portal       boards   hit rate   with matches   matching jobs   boards to double-check");
  for (const portal of Object.keys(PORTALS)) {
    const rows = all.filter((b) => b.portal === portal);
    const withMatches = rows.filter((b) => b.matching.length > 0).length;
    const jobs = rows.reduce((n, b) => n + b.matching.length, 0);
    const check = rows.filter((b) => b.matchCheck === "check").length;
    console.log(
      `${portal.padEnd(12)} ${String(rows.length).padStart(6)} ${rate(rows.length, companies.length).padStart(10)} ${String(withMatches).padStart(14)} ${String(jobs).padStart(15)} ${String(check).padStart(24)}`
    );
  }

  // Hit rate = companies with at least one board, as a share of companies checked.
  const withBoard = new Set(all.map((b) => b.company));
  const bySource = new Map();
  for (const c of companies) {
    const s = bySource.get(c.source) ?? { total: 0, hit: 0 };
    s.total++;
    if (withBoard.has(c.name)) s.hit++;
    bySource.set(c.source, s);
  }
  console.log("\nHit rate (companies with at least one board on any portal):");
  for (const [source, s] of bySource) {
    console.log(`  ${source.padEnd(52)} ${String(s.hit).padStart(3)} of ${String(s.total).padStart(3)}  ${rate(s.hit, s.total)}`);
  }
  console.log(`  ${"All companies".padEnd(52)} ${String(withBoard.size).padStart(3)} of ${String(companies.length).padStart(3)}  ${rate(withBoard.size, companies.length)}`);
  const top = all.filter((b) => b.matching.length).sort((a, b) => b.matching.length - a.matching.length).slice(0, 10);
  if (top.length) {
    console.log("\nTop boards by matching jobs:");
    for (const b of top) console.log(`  ${b.matching.length}  ${b.company} (${b.portal}/${b.slug}) ${b.matchCheck === "check" ? "[double-check name]" : ""}`);
  }
  if (stats.other > stats.requests * 0.2) {
    console.log("\nWarning: more than 20% of requests failed. The counts above may be too low. Try again with a higher --delay.");
  }
  console.log(`\nFiles written to ${outDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(`\nStopped: ${e.message}`);
    process.exit(1);
  });
}
