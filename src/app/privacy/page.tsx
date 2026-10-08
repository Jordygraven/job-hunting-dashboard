import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Privacy Policy</h1>
      <p>
        This is a personal job search tracker with a single user: its owner. It is not a
        public product and does not accept other users.
      </p>

      <h2>Google access</h2>
      <p>
        This app requests read-only access to Gmail. It only reads LinkedIn job alert emails
        from jobalerts-noreply@linkedin.com. It does not read, send, or modify any other email.
      </p>

      <h2>Data stored</h2>
      <p>For each job vacancy, the app stores:</p>
      <ul>
        <li>Job title</li>
        <li>Company</li>
        <li>Location</li>
        <li>A job link, rebuilt from the job ID</li>
        <li>The Gmail message ID the vacancy was found in</li>
        <li>The date the vacancy was first seen</li>
        <li>The owner&apos;s triage actions (such as applied, ignored, or undone)</li>
      </ul>
      <p>
        The app also stores sync logs, including sync run IDs and error reasons. Email content
        itself is never stored.
      </p>

      <h2>Where data is stored</h2>
      <p>
        Data is stored in Supabase (Singapore region) and the app is hosted on Vercel. Data is
        not shared or sold to any third party, and is not used for advertising. The app does
        not use analytics or tracking cookies.
      </p>

      <h2>Data retention and access</h2>
      <p>
        Data is kept until the owner deletes it. Google account access for this app can be
        revoked at any time from the Google Account&apos;s third-party connections settings.
      </p>

      <h2>Google API Services User Data Policy</h2>
      <p>
        Use of data from Google APIs adheres to the Google API Services User Data Policy,
        including the Limited Use requirements.
      </p>

      <h2>Contact</h2>
      <p>Contact: owner@example.com</p>

      <p>Last updated: 2026-10-08</p>
    </main>
  );
}
