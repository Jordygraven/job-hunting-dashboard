#!/usr/bin/env node
// Run with: node --env-file=.env.local scripts/save-samples.mjs
import { google } from "googleapis";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
];

for (const name of REQUIRED_ENV_VARS) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const { data } = await gmail.users.messages.list({
  userId: "me",
  q: "from:jobalerts-noreply@linkedin.com",
  maxResults: 15,
});

const messages = data.messages ?? [];
const outDir = join(process.cwd(), "samples", "linkedin");
await mkdir(outDir, { recursive: true });

for (const { id } of messages) {
  const [{ data: raw }, { data: metadata }] = await Promise.all([
    gmail.users.messages.get({ userId: "me", id, format: "raw" }),
    gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["Subject"],
    }),
  ]);

  const subject =
    metadata.payload?.headers?.find((h) => h.name === "Subject")?.value ?? "";
  const fileName = `${id}.eml`;

  await writeFile(join(outDir, fileName), Buffer.from(raw.raw, "base64url"));
  console.log(`${fileName}  ${subject}`);
}
