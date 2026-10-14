import { runSync } from "@/lib/sync/runSync";
import { SyncDatabaseError } from "@/lib/sync/upsertChunks";
import { constantTimeEqual } from "@/lib/auth/basicAuth";

function isAuthorizedCronRequest(authHeader: string | null, expectedSecret: string | undefined): boolean {
  if (!expectedSecret) return false;
  if (!authHeader) return false;

  const schemeMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!schemeMatch) return false;

  return constantTimeEqual(schemeMatch[1], expectedSecret);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!isAuthorizedCronRequest(authHeader, cronSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runSync("cron");
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyncDatabaseError) {
      return Response.json({ error: "database error" }, { status: 500 });
    }
    console.error(error);
    return Response.json({ error: "sync failed" }, { status: 500 });
  }
}
