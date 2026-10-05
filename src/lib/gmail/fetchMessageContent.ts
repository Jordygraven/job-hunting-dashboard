import type { gmail_v1 } from "googleapis";
import { getGmailClient } from "./client";

export interface MessageContent {
  id: string;
  internalDate: string;
  text: string;
}

function findTextPlainData(
  part: gmail_v1.Schema$MessagePart | undefined
): string | undefined {
  if (!part) return undefined;

  if (part.mimeType === "text/plain" && part.body?.data) {
    return part.body.data;
  }

  for (const child of part.parts ?? []) {
    const found = findTextPlainData(child);
    if (found) return found;
  }

  return undefined;
}

export async function fetchMessageContent(id: string): Promise<MessageContent> {
  const gmail = getGmailClient();
  const { data } = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });

  const encoded = findTextPlainData(data.payload);
  const text = encoded ? Buffer.from(encoded, "base64url").toString("utf-8") : "";

  return {
    id,
    internalDate: data.internalDate ?? "0",
    text,
  };
}
