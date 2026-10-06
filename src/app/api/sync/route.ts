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
