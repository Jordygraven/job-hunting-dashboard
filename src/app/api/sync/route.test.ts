import { beforeEach, describe, expect, test, vi } from "vitest";

let runSyncMock: any;

vi.mock("@/lib/sync/runSync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sync/runSync")>("@/lib/sync/runSync");
  return {
    ...actual,
    runSync: (...args: any[]) => runSyncMock(...args),
  };
});

import { GET } from "./route";

function request(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) headers.set("authorization", authHeader);
  return new Request("https://example.com/api/sync", { headers });
}

beforeEach(() => {
  runSyncMock = vi.fn();
  vi.unstubAllEnvs();
});

describe("GET /api/sync", () => {
  test("denies access when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(request("Bearer anything"));
    expect(response.status).toBe(401);
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  test("rejects a missing authorization header", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    const response = await GET(request(null));
    expect(response.status).toBe(401);
  });

  test("rejects the wrong token", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    const response = await GET(request("Bearer wrong"));
    expect(response.status).toBe(401);
  });

  test("accepts the correct Bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    runSyncMock.mockResolvedValue({ messages: 1 });
    const response = await GET(request("Bearer secret123"));
    expect(response.status).toBe(200);
    expect(runSyncMock).toHaveBeenCalledWith("cron");
  });

  test("accepts the Bearer scheme case-insensitively", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    runSyncMock.mockResolvedValue({ messages: 1 });
    const response = await GET(request("bearer secret123"));
    expect(response.status).toBe(200);
  });

  test("rejects an unrelated scheme", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    const response = await GET(request("Basic secret123"));
    expect(response.status).toBe(401);
  });
});
