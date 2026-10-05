// One-time script: gets a Gmail refresh token and saves it straight into .env.local.
// Run with: node --env-file=.env.local scripts/get-refresh-token.mjs
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { exec } from "node:child_process";
import { google } from "googleapis";

const ENV_FILE = ".env.local";
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local");
  process.exit(1);
}

// Random value that Google sends back, so we only accept a reply to our own login request.
const state = crypto.randomBytes(16).toString("hex");
let oauth2Client;

function saveRefreshToken(token) {
  const content = fs.readFileSync(ENV_FILE, "utf8");
  const line = `GOOGLE_REFRESH_TOKEN=${token}`;
  const pattern = /^GOOGLE_REFRESH_TOKEN=.*$/m;
  const updated = pattern.test(content)
    ? content.replace(pattern, () => line)
    : `${content.trimEnd()}\n${line}\n`;
  fs.writeFileSync(ENV_FILE, updated);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname !== "/") {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  try {
    if (url.searchParams.get("state") !== state || !code) {
      throw new Error(url.searchParams.get("error") ?? "Unexpected reply from Google");
    }

    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) throw new Error("Google returned no refresh token");
    saveRefreshToken(tokens.refresh_token);

    // Real test: a fresh client with ONLY the refresh token, exactly like the daily sync will work.
    const testClient = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    testClient.setCredentials({ refresh_token: tokens.refresh_token });
    const gmail = google.gmail({ version: "v1", auth: testClient });
    const { data } = await gmail.users.getProfile({ userId: "me" });

    console.log(`Refresh token saved to ${ENV_FILE}.`);
    console.log(`Test call OK: ${data.emailAddress} has ${data.messagesTotal} messages.`);
    res.end("Done. You can close this tab and go back to the terminal.");
  } catch (err) {
    console.error("Failed:", err.message);
    process.exitCode = 1;
    res.end("Something went wrong. Check the terminal.");
  } finally {
    server.close();
    server.closeAllConnections();
  }
});

// Port 0 lets the operating system pick any free port. Desktop app clients accept any local port.
server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `http://127.0.0.1:${port}`
  );
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // asks for a refresh token, not just a 1-hour access token
    prompt: "consent",      // forces Google to issue a new refresh token every run
    scope: SCOPES,
    state,
  });
  console.log("Opening your browser to log in. If it does not open, paste this URL:\n");
  console.log(authUrl);
  exec(`open "${authUrl}"`);
});