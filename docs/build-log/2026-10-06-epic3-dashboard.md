# Epic 3: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the dashboard: shared sync logic that always logs a `sync_runs` row, a Basic Auth gate over the whole app, a vacancy list, a sync status/alert banner, and a manual sync button — on branch `feat/dashboard`.

**Architecture:** Extract the existing `/api/sync` logic into `runSync(trigger)` so both the cron route and a new Server Action share one code path and one `sync_runs` write. Gate the app with a Next.js 16 `proxy.ts` doing constant-time Basic Auth (except `/api/sync` and static assets). Add a server-rendered `/` page that reads `vacancies` and the latest `sync_runs` row directly from Supabase on every request.

**Tech Stack:** Next.js 16.3.8 (App Router), React 19, TypeScript, Supabase JS client, Vitest.

**Spec:** The user's task message for "Epic 3: dashboard" (branch `feat/dashboard`, 5 commits, reviewer checks) — reproduced in full in the conversation that produced this plan. There is no separate spec file; this plan is the only durable copy.

## Global Constraints

- Never read, print, or log values from `.env.local`; refer to env var names only.
- Never run schema-changing or destructive SQL — `sync_runs` already exists by hand.
- Never call `.update()` or `.delete()` on any Supabase table from this codebase. Only `.select()`/`.insert()`/`.upsert()`.
- `sync_runs` columns: `id, trigger ('cron'|'manual'), status ('ok'|'error'), started_at, finished_at, messages, cards, unique_jobs, inserted, skipped, warnings, parser_failure_count (all integer, null on error runs), parser_failures jsonb, failures jsonb (both default []), error text (required when status='error', null otherwise), created_at`.
- `service_role` has only INSERT and SELECT on `sync_runs` and `vacancies` — Supabase access stays server-only, never imported into client components.
- One concern per commit — 5 commits total, matching the 5 tasks below.
- `/api/sync` keeps its current Bearer-token auth, response shape, and status codes unchanged.
- Basic Auth: any username, password must equal `DASHBOARD_PASSWORD` compared in constant time; unset `DASHBOARD_PASSWORD` denies access entirely.
- Vacancy list: server component, rendered on every request (no caching), newest first by `first_seen_at`, columns Title/Company/Location (blank allowed)/First seen (Asia/Kuala_Lumpur, "6 Oct 2026", never labelled "Posted")/Link (`target="_blank" rel="noopener noreferrer"`), with an empty state.
- `getSyncAlert` only alerts for: no run exists, latest run >26h old, `status === 'error'`, `failures` non-empty, `parser_failure_count > 0`. Warnings alone never alert.
- Manual sync button is disabled while the sync is running and shows returned counts or the error.
- Finish: `npm test` and `npm run build` must pass, push the branch, do not open a PR.

## Review Focus

- A crash before any message is fetched (e.g. the Gmail API call itself throws) must still write exactly one `sync_runs` row with `status: 'error'` and non-null `error` text — never zero rows. → tested in Task 1.
- `DASHBOARD_PASSWORD` unset must deny every Basic-Auth-protected request, not fail open. → tested in Task 2.
- A correct password with an arbitrary/empty username must still be accepted — nothing should validate the username. → tested in Task 2.
- A UTC timestamp that crosses midnight into the next Kuala Lumpur day must render the KL date, not the UTC date. → tested in Task 3.
- `getSyncAlert` must not alert when only `warnings` is non-zero, even if every other field is otherwise clean. → tested in Task 4.

---

## Task 1: Shared sync logic (`runSync`)

**Files:**
- Create: `src/lib/sync/runSync.ts`
- Create: `src/lib/sync/runSync.test.ts`
- Modify: `src/app/api/sync/route.ts`

**Interfaces:**
- Consumes: `fetchLinkedInAlerts()` from `@/lib/gmail/fetchLinkedInAlerts` (returns `LinkedInAlertMessage[]`), `fetchMessageContent(id)` from `@/lib/gmail/fetchMessageContent` (returns `Promise<MessageContent>`), `parseLinkedInAlert(text)` from `@/lib/parsers/linkedin` (returns `ParseResult`), `toVacancyRows`/`uniqueVacancyRows` from `@/lib/sync/vacancyRows`, `toParserFailures`/`ParserFailure` from `@/lib/sync/parserFailures`, `getSupabaseServerClient()` from `@/lib/supabase/server`.
- Produces: `runSync(trigger: "cron" | "manual"): Promise<SyncResult>`, `SyncResult` (`{ messages, cards, unique, inserted, skipped, warnings, parserFailureCount, parserFailures, failures }`), `SyncFailure` (`{ messageId: string; reason: string }`), `SyncDatabaseError` (an `Error` subclass thrown when the `vacancies` upsert itself fails). Later tasks (4) read `sync_runs` rows this task writes.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/sync/runSync.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchLinkedInAlertsMock = vi.fn();
const fetchMessageContentMock = vi.fn();
const parseLinkedInAlertMock = vi.fn();
const fromMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@/lib/gmail/fetchLinkedInAlerts", () => ({
  fetchLinkedInAlerts: fetchLinkedInAlertsMock,
}));
vi.mock("@/lib/gmail/fetchMessageContent", () => ({
  fetchMessageContent: fetchMessageContentMock,
}));
vi.mock("@/lib/parsers/linkedin", () => ({
  parseLinkedInAlert: parseLinkedInAlertMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

import { runSync, SyncDatabaseError } from "./runSync";

function upsertTable(result: { data: unknown; error: unknown }) {
  return { upsert: () => ({ select: () => Promise.resolve(result) }) };
}

function syncRunsTable() {
  return { insert: insertMock };
}

beforeEach(() => {
  vi.clearAllMocks();
  insertMock.mockResolvedValue({ error: null });
});

describe("runSync success", () => {
  test("writes one ok sync_runs row with matching counts and returns the same result", async () => {
    fromMock.mockImplementation((table: string) =>
      table === "vacancies"
        ? upsertTable({ data: [{ id: 1 }], error: null })
        : syncRunsTable()
    );
    fetchLinkedInAlertsMock.mockResolvedValue([{ id: "m1", threadId: "t1", date: "", subject: "" }]);
    fetchMessageContentMock.mockResolvedValue({ id: "m1", internalDate: "1000", text: "body" });
    parseLinkedInAlertMock.mockReturnValue({
      cards: [{ jobId: "1", title: "Widget Engineer", company: "Acme", location: "Remote", url: "https://x" }],
      warnings: [],
      failures: [],
    });

    const result = await runSync("cron");

    expect(result).toEqual({
      messages: 1,
      cards: 1,
      unique: 1,
      inserted: 1,
      skipped: 0,
      warnings: 0,
      parserFailureCount: 0,
      parserFailures: [],
      failures: [],
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row).toMatchObject({
      trigger: "cron",
      status: "ok",
      messages: 1,
      cards: 1,
      unique_jobs: 1,
      inserted: 1,
      skipped: 0,
      warnings: 0,
      parser_failure_count: 0,
      parser_failures: [],
      failures: [],
      error: null,
    });
    expect(row.started_at).toBeTypeOf("string");
    expect(row.finished_at).toBeTypeOf("string");
  });
});

describe("runSync crash before any message is fetched", () => {
  test("writes exactly one error sync_runs row with null counts and rethrows", async () => {
    fromMock.mockImplementation(() => syncRunsTable());
    fetchLinkedInAlertsMock.mockRejectedValue(new Error("gmail unreachable"));

    await expect(runSync("cron")).rejects.toThrow("gmail unreachable");

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row).toMatchObject({
      trigger: "cron",
      status: "error",
      messages: null,
      cards: null,
      unique_jobs: null,
      inserted: null,
      skipped: null,
      warnings: null,
      parser_failure_count: null,
      parser_failures: [],
      failures: [],
      error: "gmail unreachable",
    });
  });
});

describe("runSync database upsert failure", () => {
  test("writes one error sync_runs row and throws SyncDatabaseError", async () => {
    fromMock.mockImplementation((table: string) =>
      table === "vacancies"
        ? upsertTable({ data: null, error: { message: "duplicate key" } })
        : syncRunsTable()
    );
    fetchLinkedInAlertsMock.mockResolvedValue([{ id: "m1", threadId: "t1", date: "", subject: "" }]);
    fetchMessageContentMock.mockResolvedValue({ id: "m1", internalDate: "1000", text: "body" });
    parseLinkedInAlertMock.mockReturnValue({
      cards: [{ jobId: "1", title: "Widget Engineer", company: "Acme", location: "Remote", url: "https://x" }],
      warnings: [],
      failures: [],
    });

    await expect(runSync("manual")).rejects.toBeInstanceOf(SyncDatabaseError);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      trigger: "manual",
      status: "error",
      messages: null,
      error: "duplicate key",
    });
  });
});

describe("runSync when the sync_runs insert itself fails", () => {
  test("logs the error but still returns the sync result", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fromMock.mockImplementation((table: string) =>
      table === "vacancies"
        ? upsertTable({ data: [], error: null })
        : { insert: () => Promise.resolve({ error: { message: "insert failed" } }) }
    );
    fetchLinkedInAlertsMock.mockResolvedValue([]);

    const result = await runSync("cron");

    expect(result.messages).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/sync/runSync.test.ts`
Expected: FAIL with "Cannot find module './runSync'" (the file doesn't exist yet).

- [ ] **Step 3: Write `runSync.ts`**

```typescript
// src/lib/sync/runSync.ts
import { fetchLinkedInAlerts } from "@/lib/gmail/fetchLinkedInAlerts";
import { fetchMessageContent } from "@/lib/gmail/fetchMessageContent";
import { parseLinkedInAlert } from "@/lib/parsers/linkedin";
import { toVacancyRows, uniqueVacancyRows, type VacancyRow } from "@/lib/sync/vacancyRows";
import { toParserFailures, type ParserFailure } from "@/lib/sync/parserFailures";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SyncTrigger = "cron" | "manual";

export interface SyncFailure {
  messageId: string;
  reason: string;
}

export interface SyncResult {
  messages: number;
  cards: number;
  unique: number;
  inserted: number;
  skipped: number;
  warnings: number;
  parserFailureCount: number;
  parserFailures: ParserFailure[];
  failures: SyncFailure[];
}

export class SyncDatabaseError extends Error {}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

async function recordSyncRun(args: {
  trigger: SyncTrigger;
  startedAt: Date;
  finishedAt: Date;
  status: "ok" | "error";
  counts: {
    messages: number;
    cards: number;
    uniqueJobs: number;
    inserted: number;
    skipped: number;
    warnings: number;
    parserFailureCount: number;
  } | null;
  parserFailures: ParserFailure[];
  failures: SyncFailure[];
  error: string | null;
}): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("sync_runs").insert({
      trigger: args.trigger,
      status: args.status,
      started_at: args.startedAt.toISOString(),
      finished_at: args.finishedAt.toISOString(),
      messages: args.counts?.messages ?? null,
      cards: args.counts?.cards ?? null,
      unique_jobs: args.counts?.uniqueJobs ?? null,
      inserted: args.counts?.inserted ?? null,
      skipped: args.counts?.skipped ?? null,
      warnings: args.counts?.warnings ?? null,
      parser_failure_count: args.counts?.parserFailureCount ?? null,
      parser_failures: args.parserFailures,
      failures: args.failures,
      error: args.error,
    });

    if (error) {
      console.error("Failed to record sync_runs row:", error.message);
    }
  } catch (error) {
    console.error("Failed to record sync_runs row:", reasonFor(error));
  }
}

export async function runSync(trigger: SyncTrigger): Promise<SyncResult> {
  const startedAt = new Date();

  try {
    const alerts = await fetchLinkedInAlerts();
    const failures: SyncFailure[] = [];

    const fetched = await Promise.allSettled(
      alerts.map((alert) => fetchMessageContent(alert.id))
    );

    const contents: { id: string; internalDate: number; text: string }[] = [];
    for (let i = 0; i < fetched.length; i++) {
      const result = fetched[i];
      if (result.status === "fulfilled") {
        contents.push({
          id: result.value.id,
          internalDate: Number(result.value.internalDate),
          text: result.value.text,
        });
      } else {
        failures.push({ messageId: alerts[i].id, reason: reasonFor(result.reason) });
      }
    }

    contents.sort((a, b) => a.internalDate - b.internalDate);

    let warnings = 0;
    const allRows: VacancyRow[] = [];
    const parserFailures: ParserFailure[] = [];

    for (const message of contents) {
      try {
        const { cards, warnings: cardWarnings, failures: cardFailures } = parseLinkedInAlert(
          message.text
        );
        warnings += cardWarnings.length;
        parserFailures.push(...toParserFailures(message.id, cardFailures));
        allRows.push(...toVacancyRows(cards, message.id, new Date(message.internalDate)));
      } catch (error) {
        failures.push({ messageId: message.id, reason: reasonFor(error) });
      }
    }

    const uniqueRows = uniqueVacancyRows(allRows);

    let inserted = 0;
    if (uniqueRows.length > 0) {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from("vacancies")
        .upsert(uniqueRows, { onConflict: "source,source_job_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        throw new SyncDatabaseError(reasonFor(error));
      }

      inserted = data?.length ?? 0;
    }

    const skipped = uniqueRows.length - inserted;
    const result: SyncResult = {
      messages: alerts.length,
      cards: allRows.length,
      unique: uniqueRows.length,
      inserted,
      skipped,
      warnings,
      parserFailureCount: parserFailures.length,
      parserFailures,
      failures,
    };

    await recordSyncRun({
      trigger,
      startedAt,
      finishedAt: new Date(),
      status: "ok",
      counts: {
        messages: result.messages,
        cards: result.cards,
        uniqueJobs: result.unique,
        inserted: result.inserted,
        skipped: result.skipped,
        warnings: result.warnings,
        parserFailureCount: result.parserFailureCount,
      },
      parserFailures: result.parserFailures,
      failures: result.failures,
      error: null,
    });

    return result;
  } catch (error) {
    await recordSyncRun({
      trigger,
      startedAt,
      finishedAt: new Date(),
      status: "error",
      counts: null,
      parserFailures: [],
      failures: [],
      error: reasonFor(error),
    });

    throw error;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/sync/runSync.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Rewrite the route to call `runSync`**

```typescript
// src/app/api/sync/route.ts
import { runSync, SyncDatabaseError } from "@/lib/sync/runSync";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runSync("cron");
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyncDatabaseError) {
      return Response.json({ error: "database error" }, { status: 500 });
    }
    throw error;
  }
}
```

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS, all existing tests plus the 4 new ones.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync/runSync.ts src/lib/sync/runSync.test.ts src/app/api/sync/route.ts
git commit -m "$(cat <<'EOF'
Move /api/sync logic into runSync(trigger), log every run to sync_runs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Password gate (Basic Auth)

**Files:**
- Create: `src/lib/auth/basicAuth.ts`
- Create: `src/lib/auth/basicAuth.test.ts`
- Create: `src/proxy.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `isAuthorized(authHeader: string | null, expectedPassword: string | undefined): boolean` — pure function, no Next.js types, importable from `proxy.ts`.
- Consumes (in `proxy.ts` only): `NextRequest`/`NextResponse` from `next/server`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/auth/basicAuth.test.ts
import { describe, expect, test } from "vitest";
import { isAuthorized } from "./basicAuth";

function basicHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

describe("isAuthorized", () => {
  test("accepts any username with the correct password", () => {
    expect(isAuthorized(basicHeader("anything", "secret123"), "secret123")).toBe(true);
    expect(isAuthorized(basicHeader("", "secret123"), "secret123")).toBe(true);
  });

  test("rejects the wrong password", () => {
    expect(isAuthorized(basicHeader("user", "wrong"), "secret123")).toBe(false);
  });

  test("rejects a missing authorization header", () => {
    expect(isAuthorized(null, "secret123")).toBe(false);
  });

  test("denies access when DASHBOARD_PASSWORD is unset", () => {
    expect(isAuthorized(basicHeader("user", "secret123"), undefined)).toBe(false);
    expect(isAuthorized(basicHeader("user", ""), "")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/auth/basicAuth.test.ts`
Expected: FAIL with "Cannot find module './basicAuth'"

- [ ] **Step 3: Write `basicAuth.ts`**

```typescript
// src/lib/auth/basicAuth.ts
function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length);

  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return diff === 0;
}

export function isAuthorized(
  authHeader: string | null,
  expectedPassword: string | undefined
): boolean {
  if (!expectedPassword) return false;
  if (!authHeader?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice("Basic ".length), "base64").toString("utf-8");
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;

  const suppliedPassword = decoded.slice(separatorIndex + 1);
  return constantTimeEqual(suppliedPassword, expectedPassword);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth/basicAuth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write `proxy.ts`**

Next.js 16.3.8 renamed `middleware.ts` to `proxy.ts` (export `proxy()` + `proxyConfig`, same capabilities as the old `middleware()` + `config`). Confirmed against the installed `next` package (16.3.8).

```typescript
// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthorized } from "@/lib/auth/basicAuth";

export function proxy(request: NextRequest) {
  if (isAuthorized(request.headers.get("authorization"), process.env.DASHBOARD_PASSWORD)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Job Hunting Dashboard"' },
  });
}

export const proxyConfig = {
  matcher: ["/((?!api/sync|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Add env var names to `.env.example`**

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
DASHBOARD_PASSWORD=
VERCEL_AUTOMATION_BYPASS_SECRET=
```

- [ ] **Step 7: Run the full suite and build**

Run: `npx vitest run && npm run build`
Expected: PASS / build succeeds. Confirm in the build output that `proxy` (or `middleware`) is listed as compiled, and that `/api/sync` is excluded from its matcher.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/basicAuth.ts src/lib/auth/basicAuth.test.ts src/proxy.ts .env.example
git commit -m "$(cat <<'EOF'
Add Basic Auth gate over the app, excluding /api/sync and static assets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Vacancy list at `/`

**Files:**
- Create: `src/lib/format/kualaLumpurTime.ts`
- Create: `src/lib/format/kualaLumpurTime.test.ts`
- Create: `src/lib/vacancies/getVacancies.ts`
- Modify: `src/app/page.tsx`
- Modify: `BACKLOG.md`

**Interfaces:**
- Produces: `formatKlDate(iso: string): string` (e.g. `"6 Oct 2026"`), `formatKlDateTime(iso: string): string` (e.g. `"6 Oct 2026, 14:32"`) — both consumed again in Task 4's status panel.
- Produces: `getVacancies(): Promise<Vacancy[]>` where `Vacancy = { id: number; title: string; company: string; location: string | null; url: string; firstSeenAt: string }`.

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/format/kualaLumpurTime.test.ts`
Expected: FAIL with "Cannot find module './kualaLumpurTime'"

- [ ] **Step 3: Write `kualaLumpurTime.ts`**

```typescript
// src/lib/format/kualaLumpurTime.ts
const KL_TIME_ZONE = "Asia/Kuala_Lumpur";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatKlDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatKlDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso)).replace(" at ", ", ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/format/kualaLumpurTime.test.ts`
Expected: PASS (3 tests). If `formatKlDateTime`'s exact separator doesn't match `", "` in this Node/ICU version, adjust the `.replace(...)` (or formatter options) until the assertion passes — the `.replace(" at ", ", ")` call guards against `en-GB`'s ICU output using "at" as a separator in some Node builds.

- [ ] **Step 5: Write `getVacancies.ts`**

```typescript
// src/lib/vacancies/getVacancies.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface Vacancy {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  firstSeenAt: string;
}

export async function getVacancies(): Promise<Vacancy[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("vacancies")
    .select("id, title, company, location, url, first_seen_at")
    .order("first_seen_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    firstSeenAt: row.first_seen_at,
  }));
}
```

- [ ] **Step 6: Rewrite `page.tsx`**

```tsx
// src/app/page.tsx
import { getVacancies } from "@/lib/vacancies/getVacancies";
import { formatKlDate } from "@/lib/format/kualaLumpurTime";

export const dynamic = "force-dynamic";

export default async function Home() {
  const vacancies = await getVacancies();

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl mx-auto flex-col py-12 px-6">
        <h1 className="text-2xl font-semibold mb-6 text-black dark:text-zinc-50">
          Vacancies
        </h1>

        {vacancies.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">No vacancies yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">First seen</th>
                <th className="py-2 pr-4">Link</th>
              </tr>
            </thead>
            <tbody>
              {vacancies.map((vacancy) => (
                <tr key={vacancy.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{vacancy.title}</td>
                  <td className="py-2 pr-4">{vacancy.company}</td>
                  <td className="py-2 pr-4">{vacancy.location ?? ""}</td>
                  <td className="py-2 pr-4">{formatKlDate(vacancy.firstSeenAt)}</td>
                  <td className="py-2 pr-4">
                    <a
                      href={vacancy.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Add the deferred idea to `BACKLOG.md`**

```markdown
- Paginate vacancy list (deferred 6 Oct).
```

- [ ] **Step 8: Run the full suite and build**

Run: `npx vitest run && npm run build`
Expected: PASS / build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/lib/format/kualaLumpurTime.ts src/lib/format/kualaLumpurTime.test.ts src/lib/vacancies/getVacancies.ts src/app/page.tsx BACKLOG.md
git commit -m "$(cat <<'EOF'
Render the vacancy list on / as a server component, no caching

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Sync status and alert

**Files:**
- Create: `src/lib/sync/syncRunRecord.ts`
- Create: `src/lib/sync/getSyncAlert.ts`
- Create: `src/lib/sync/getSyncAlert.test.ts`
- Create: `src/lib/sync/getLatestSyncRun.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `formatKlDateTime` from `@/lib/format/kualaLumpurTime` (Task 3), `getSupabaseServerClient` from `@/lib/supabase/server`.
- Produces: `SyncRunRecord` type, `getSyncAlert(latestRun: SyncRunRecord | null, now: Date): AlertReason[]`, `getLatestSyncRun(): Promise<SyncRunRecord | null>`. Task 5 does not depend on these directly but shares the same `page.tsx`.

- [ ] **Step 1: Write `syncRunRecord.ts`** (shared type, no logic to test)

```typescript
// src/lib/sync/syncRunRecord.ts
export interface SyncRunFailure {
  messageId: string;
  reason: string;
}

export interface SyncRunRecord {
  trigger: "cron" | "manual";
  status: "ok" | "error";
  startedAt: string;
  finishedAt: string;
  messages: number | null;
  cards: number | null;
  uniqueJobs: number | null;
  inserted: number | null;
  skipped: number | null;
  warnings: number | null;
  parserFailureCount: number | null;
  parserFailures: SyncRunFailure[];
  failures: SyncRunFailure[];
  error: string | null;
}
```

- [ ] **Step 2: Write the failing tests for `getSyncAlert`**

```typescript
// src/lib/sync/getSyncAlert.test.ts
import { describe, expect, test } from "vitest";
import { getSyncAlert } from "./getSyncAlert";
import type { SyncRunRecord } from "./syncRunRecord";

const NOW = new Date("2026-10-06T12:00:00.000Z");

function run(overrides: Partial<SyncRunRecord> = {}): SyncRunRecord {
  return {
    trigger: "cron",
    status: "ok",
    startedAt: "2026-10-06T11:00:00.000Z",
    finishedAt: "2026-10-06T11:05:00.000Z",
    messages: 2,
    cards: 3,
    uniqueJobs: 3,
    inserted: 3,
    skipped: 0,
    warnings: 0,
    parserFailureCount: 0,
    parserFailures: [],
    failures: [],
    error: null,
    ...overrides,
  };
}

describe("getSyncAlert", () => {
  test("alerts when no run exists", () => {
    expect(getSyncAlert(null, NOW)).toEqual([{ type: "no-run" }]);
  });

  test("alerts when the latest run is older than 26 hours", () => {
    const staleRun = run({ finishedAt: "2026-10-05T09:00:00.000Z" }); // 27h before NOW
    expect(getSyncAlert(staleRun, NOW)).toEqual([
      { type: "stale", finishedAt: "2026-10-05T09:00:00.000Z" },
    ]);
  });

  test("does not alert for a fresh, ok run with no failures", () => {
    expect(getSyncAlert(run(), NOW)).toEqual([]);
  });

  test("alerts when status is error", () => {
    const errorRun = run({ status: "error", error: "gmail unreachable", messages: null, cards: null, uniqueJobs: null, inserted: null, skipped: null, warnings: null, parserFailureCount: null });
    expect(getSyncAlert(errorRun, NOW)).toEqual([
      { type: "error", error: "gmail unreachable" },
    ]);
  });

  test("alerts when failures is non-empty, including messageId and reason", () => {
    const failingRun = run({ failures: [{ messageId: "m1", reason: "fetch timeout" }] });
    expect(getSyncAlert(failingRun, NOW)).toEqual([
      { type: "failures", failures: [{ messageId: "m1", reason: "fetch timeout" }] },
    ]);
  });

  test("alerts when parser_failure_count is greater than zero", () => {
    const parserFailingRun = run({
      parserFailureCount: 1,
      parserFailures: [{ messageId: "m1", reason: "card is missing a title or company" }],
    });
    expect(getSyncAlert(parserFailingRun, NOW)).toEqual([
      {
        type: "parser-failures",
        count: 1,
        parserFailures: [{ messageId: "m1", reason: "card is missing a title or company" }],
      },
    ]);
  });

  test("does not alert when only warnings are present", () => {
    expect(getSyncAlert(run({ warnings: 5 }), NOW)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/sync/getSyncAlert.test.ts`
Expected: FAIL with "Cannot find module './getSyncAlert'"

- [ ] **Step 4: Write `getSyncAlert.ts`**

```typescript
// src/lib/sync/getSyncAlert.ts
import type { SyncRunFailure, SyncRunRecord } from "./syncRunRecord";

const STALE_THRESHOLD_HOURS = 26;

export type AlertReason =
  | { type: "no-run" }
  | { type: "stale"; finishedAt: string }
  | { type: "error"; error: string }
  | { type: "failures"; failures: SyncRunFailure[] }
  | { type: "parser-failures"; count: number; parserFailures: SyncRunFailure[] };

export function getSyncAlert(latestRun: SyncRunRecord | null, now: Date): AlertReason[] {
  if (!latestRun) {
    return [{ type: "no-run" }];
  }

  const reasons: AlertReason[] = [];

  const ageHours =
    (now.getTime() - new Date(latestRun.finishedAt).getTime()) / (1000 * 60 * 60);
  if (ageHours > STALE_THRESHOLD_HOURS) {
    reasons.push({ type: "stale", finishedAt: latestRun.finishedAt });
  }

  if (latestRun.status === "error") {
    reasons.push({ type: "error", error: latestRun.error ?? "unknown error" });
  }

  if (latestRun.failures.length > 0) {
    reasons.push({ type: "failures", failures: latestRun.failures });
  }

  if ((latestRun.parserFailureCount ?? 0) > 0) {
    reasons.push({
      type: "parser-failures",
      count: latestRun.parserFailureCount ?? 0,
      parserFailures: latestRun.parserFailures,
    });
  }

  return reasons;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/sync/getSyncAlert.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Write `getLatestSyncRun.ts`**

```typescript
// src/lib/sync/getLatestSyncRun.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SyncRunRecord } from "./syncRunRecord";

export async function getLatestSyncRun(): Promise<SyncRunRecord | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .select(
      "trigger, status, started_at, finished_at, messages, cards, unique_jobs, inserted, skipped, warnings, parser_failure_count, parser_failures, failures, error"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    trigger: data.trigger,
    status: data.status,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    messages: data.messages,
    cards: data.cards,
    uniqueJobs: data.unique_jobs,
    inserted: data.inserted,
    skipped: data.skipped,
    warnings: data.warnings,
    parserFailureCount: data.parser_failure_count,
    parserFailures: data.parser_failures ?? [],
    failures: data.failures ?? [],
    error: data.error,
  };
}
```

- [ ] **Step 7: Add the status/alert panel to `page.tsx`**

```tsx
// src/app/page.tsx
import { getVacancies } from "@/lib/vacancies/getVacancies";
import { getLatestSyncRun } from "@/lib/sync/getLatestSyncRun";
import { getSyncAlert, type AlertReason } from "@/lib/sync/getSyncAlert";
import { formatKlDate, formatKlDateTime } from "@/lib/format/kualaLumpurTime";

export const dynamic = "force-dynamic";

function alertText(reason: AlertReason): string {
  switch (reason.type) {
    case "no-run":
      return "No sync has ever run.";
    case "stale":
      return `Last sync finished at ${formatKlDateTime(reason.finishedAt)}, more than 26 hours ago.`;
    case "error":
      return `Last sync failed: ${reason.error}`;
    case "failures":
      return `${reason.failures.length} message(s) failed: ${reason.failures
        .map((f) => `${f.messageId} (${f.reason})`)
        .join(", ")}`;
    case "parser-failures":
      return `${reason.count} card(s) failed to parse: ${reason.parserFailures
        .map((f) => `${f.messageId} (${f.reason})`)
        .join(", ")}`;
  }
}

export default async function Home() {
  const [vacancies, latestRun] = await Promise.all([getVacancies(), getLatestSyncRun()]);
  const alerts = getSyncAlert(latestRun, new Date());

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl mx-auto flex-col py-12 px-6 gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
            Sync status
          </h2>

          {alerts.length > 0 && (
            <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              <ul className="list-disc pl-4">
                {alerts.map((reason, index) => (
                  <li key={index}>{alertText(reason)}</li>
                ))}
              </ul>
            </div>
          )}

          {latestRun && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) —{" "}
              {latestRun.messages ?? 0} messages, {latestRun.cards ?? 0} cards,{" "}
              {latestRun.inserted ?? 0} inserted, {latestRun.skipped ?? 0} skipped,{" "}
              {latestRun.warnings ?? 0} warnings.
            </p>
          )}
        </section>

        <section>
          <h1 className="text-2xl font-semibold mb-6 text-black dark:text-zinc-50">
            Vacancies
          </h1>

          {vacancies.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">No vacancies yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">First seen</th>
                  <th className="py-2 pr-4">Link</th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((vacancy) => (
                  <tr key={vacancy.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4">{vacancy.title}</td>
                    <td className="py-2 pr-4">{vacancy.company}</td>
                    <td className="py-2 pr-4">{vacancy.location ?? ""}</td>
                    <td className="py-2 pr-4">{formatKlDate(vacancy.firstSeenAt)}</td>
                    <td className="py-2 pr-4">
                      <a
                        href={vacancy.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 underline"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Run the full suite and build**

Run: `npx vitest run && npm run build`
Expected: PASS / build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/lib/sync/syncRunRecord.ts src/lib/sync/getSyncAlert.ts src/lib/sync/getSyncAlert.test.ts src/lib/sync/getLatestSyncRun.ts src/app/page.tsx
git commit -m "$(cat <<'EOF'
Show latest sync_runs status and alert banner on /

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Manual sync button

**Files:**
- Create: `src/app/actions.ts`
- Create: `src/app/SyncButton.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `runSync` from `@/lib/sync/runSync` (Task 1), `SyncResult` type (Task 1).
- Produces: `runManualSync(): Promise<SyncResult>` (Server Action), `<SyncButton />` client component.

No new pure logic here, so no new unit tests — `runSync("manual")` is already covered by Task 1's tests, and this task is wiring (Server Action + client component), which the project's existing tests don't cover for any other route either. Verify by running the app per the manual check in Step 4.

- [ ] **Step 1: Write the Server Action**

```typescript
// src/app/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { runSync, type SyncResult } from "@/lib/sync/runSync";

export async function runManualSync(): Promise<SyncResult> {
  const result = await runSync("manual");
  revalidatePath("/");
  return result;
}
```

- [ ] **Step 2: Write the button client component**

```tsx
// src/app/SyncButton.tsx
"use client";

import { useActionState } from "react";
import { runManualSync } from "./actions";
import type { SyncResult } from "@/lib/sync/runSync";

type ActionState =
  | { status: "idle" }
  | { status: "ok"; result: SyncResult }
  | { status: "error"; message: string };

async function syncAction(_prevState: ActionState): Promise<ActionState> {
  try {
    const result = await runManualSync();
    return { status: "ok", result };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export function SyncButton() {
  const [state, formAction, isPending] = useActionState(syncAction, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>

      {state.status === "ok" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Synced: {state.result.messages} messages, {state.result.cards} cards,{" "}
          {state.result.inserted} inserted, {state.result.skipped} skipped,{" "}
          {state.result.warnings} warnings.
        </p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-700 dark:text-red-400">Sync failed: {state.message}</p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Add the button to `page.tsx`**

Add the import and render it directly below the "Sync status" heading in the "Sync status" `<section>` written in Task 4, Step 7:

```tsx
// src/app/page.tsx — add this import near the top
import { SyncButton } from "./SyncButton";
```

```tsx
// src/app/page.tsx — inside the "Sync status" <section>, directly after the <h2>
<h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
  Sync status
</h2>

<div className="mb-3">
  <SyncButton />
</div>
```

- [ ] **Step 4: Manually verify in a dev server**

Run: `npm run dev`, then in a browser visit `http://localhost:3000` (entering the Basic Auth prompt with any username and `DASHBOARD_PASSWORD`), click "Sync now", and confirm the button disables while pending and shows counts or an error afterward, and the vacancy list / sync status refresh without a full page reload.

- [ ] **Step 5: Run the full suite and build**

Run: `npx vitest run && npm run build`
Expected: PASS / build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts src/app/SyncButton.tsx src/app/page.tsx
git commit -m "$(cat <<'EOF'
Add a manual sync button that refreshes the page after running

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Finish

**Files:** none (verification + push only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, every test from Tasks 1–4 plus all pre-existing tests (`vacancyRows.test.ts`, `parserFailures.test.ts`).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Build succeeds. Record the route/middleware summary table from the build output (needed for the reviewer's "no Supabase import reachable from client code" check).

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/dashboard
```

- [ ] **Step 4: Run the reviewer sub-agent (fresh context)**

Dispatch a fresh-context review of the full `feat/dashboard` branch (vs `main`) against this checklist, verbatim:

- No Supabase import, secret, or server-only module reachable from client code. Inspect the build output, not only the source.
- `/api/sync` still returns 401 without the Bearer header and is not behind Basic Auth.
- The Server Action POST is behind Basic Auth.
- Every `runSync` path writes exactly one `sync_runs` row, crash path included, and error rows carry `error` text.
- No `.update()` or `.delete()` calls. `unique_jobs = inserted + skipped` on ok runs.
- Report severity per finding. Anything that hides a failure counts as high.

- [ ] **Step 5: Report to the user**

Summarize: the 5 commits made, `npm test` / `npm run build` results, and the reviewer's findings (with severities). Do not open a PR.
