import { getGmailClient } from "./client";

export interface LinkedInAlertMessage {
  id: string;
  threadId: string;
  date: string;
  subject: string;
}

const LINKEDIN_ALERT_SENDER = "jobalerts-noreply@linkedin.com";

export async function fetchLinkedInAlerts(
  lookbackDays = 7
): Promise<LinkedInAlertMessage[]> {
  const gmail = getGmailClient();
  const query = `from:${LINKEDIN_ALERT_SENDER} newer_than:${lookbackDays}d`;

  const messageIds: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q: query,
      pageToken,
    });

    for (const message of data.messages ?? []) {
      if (message.id && message.threadId) {
        messageIds.push({ id: message.id, threadId: message.threadId });
      }
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  const messages = await Promise.all(
    messageIds.map(async ({ id, threadId }) => {
      const { data } = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Subject", "Date"],
      });

      const headers = data.payload?.headers ?? [];
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
      const date = headers.find((h) => h.name === "Date")?.value ?? "";

      return { id, threadId, date, subject };
    })
  );

  return messages;
}
