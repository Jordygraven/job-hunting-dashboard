import { fetchLinkedInAlerts } from "@/lib/gmail/fetchLinkedInAlerts";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const messages = await fetchLinkedInAlerts();

  return Response.json({ count: messages.length, messages });
}
