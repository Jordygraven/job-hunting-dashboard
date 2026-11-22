# Job Hunting Dashboard

A personal dashboard that collects new job vacancies from my LinkedIn job alerts and from public company job boards, and helps me decide which ones to chase.

> **Status: Paused, November 2026: built for my job search, which has ended.**
> The code is public so you can read it and reuse it. Nobody maintains it.

## What it does

- **Collects vacancies.** It reads LinkedIn job alert emails in a Gmail inbox (read-only access). Optionally it also checks the public Greenhouse job boards of companies you choose, filtered by the title and location rules in `src/config/greenhouseFilter.ts`.
- **Syncs on a schedule.** A sync runs once a day (07:00 Kuala Lumpur time) and on demand with a "Sync now" button.
- **Helps me triage.** Every vacancy can be starred, ignored with a reason (language, interest, seniority, duplicate or other), marked as applied with a date, and later marked as success or rejected with an outcome date.
- **Shows the pipeline.** Tabs for To do, Interest, Applied, All, Success, Rejected and Ignored, plus search and filters by company and date, and a queue for vacancies marked for auto-drafting.
- **Keeps a record of every sync.** A syncs page lists each run with its counts and any problems.
- **Stays private.** It is a single-user tool behind one shared password, in dark theme and for desktop only.

## Why I built it

I was looking for a job in Kuala Lumpur and had been at it for a long time. When I left my job to focus on the search, I had two goals. The first was to find a new role. The second was to learn how to create my own products.

I pictured a daily dashboard that would tell me about every new vacancy, show the status of each application and help me craft my CV and cover letter. My search ended before I could build all of that. What exists is the part that mattered most: an overview of the vacancies I care about, sorted by how important they are to me.

For the first version I also set up two Claude agents, one for my CV and one for my cover letter. Together with the dashboard they helped me through to the end of my search. The setup is described in [docs/agents](docs/agents/job-application-package.md) so you can adapt it to your own requirements.

I am a product manager and not a software engineer. I defined the product and the working rules and built it with Claude Code. The plan behind each piece of work is kept in [docs/build-log](docs/build-log), so you can see how the product grew epic by epic.

## Tech stack

| Part | Choice |
| --- | --- |
| App | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS v4 and a small shared design system, [jordy-ui](https://github.com/Jordygraven/jordy-design-system) |
| Database | Supabase (Postgres) |
| Hosting and daily schedule | Vercel |
| Email source | Gmail API, read-only |
| Tests | Vitest and Testing Library |

## Run it locally

You need a recent Node.js, your own Supabase project and your own Google Cloud project.

1. **Install.**
   ```
   git clone https://github.com/Jordygraven/job-hunting-dashboard.git
   cd job-hunting-dashboard
   npm install
   ```
2. **Create the database.** In a new Supabase project, open the SQL editor and run `docs/sql/schema.sql`, then `docs/sql/epic-12-board-registry.sql`.
3. **Create your settings file.** Copy `.env.example` to `.env.local` and fill in the values:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` come from your Supabase project settings.
   - `CRON_SECRET` is a long random string of your own. It protects the sync endpoint.
   - `DASHBOARD_PASSWORD` is the password for the dashboard. Any username works.
   - `GREENHOUSE_SYNC_ENABLED` stays empty unless you set it to `true` to turn on the Greenhouse step. It also needs rows in the `boards` table, see `docs/build-log/epic-12-board-registry.md`.
4. **Connect Gmail.** In Google Cloud, enable the Gmail API, set up the OAuth consent screen, add your own Gmail address as a test user and create an OAuth client of type "Desktop app". Put its ID and secret in `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then run:
   ```
   node --env-file=.env.local scripts/get-refresh-token.mjs
   ```
   Log in when your browser opens. The script saves `GOOGLE_REFRESH_TOKEN` into `.env.local`.
5. **Set up LinkedIn alerts.** Create job alerts on LinkedIn so that emails from `jobalerts-noreply@linkedin.com` arrive in that inbox. See the limitations below about the email language.
6. **Start it.**
   ```
   npm run dev
   ```
   Open http://localhost:3000, log in with `DASHBOARD_PASSWORD` and click "Sync now".

To run the checks, use `npm test`, `npm run lint` and `npm run build`. One test reads real sample emails from a `samples/` folder that is not part of this repository, so it skips itself when that folder is missing.

To deploy, create a Vercel project from your own fork and add the same variables. `vercel.json` already defines the daily call to `/api/sync`, and Vercel sends `CRON_SECRET` with it.

## Known limitations

- **Dutch LinkedIn emails only.** I built the parser against alert emails in Dutch, so it looks for Dutch wording. If your LinkedIn language is different, change the patterns in `src/lib/parsers/linkedin.ts`, or switch your alert language.
- **The token script needs a Mac.** `scripts/get-refresh-token.mjs` opens your browser with the macOS `open` command. On another system, open the printed link yourself.
- **Google can expire tokens.** While a Google OAuth app is in testing mode, refresh tokens can expire after about a week. If the sync stops signing in, run the token script again.
- **The schema is reconstructed.** The original database was created by hand and then paused. `docs/sql/schema.sql` was rebuilt from the code and checked against a local Postgres, but it has not been run on a live Supabase project.
- **One user, one inbox.** There are no accounts, only a shared password and one Gmail inbox.
- **No live demo.** The original Supabase project is paused on purpose, so there is no hosted version to click through.
- **Not maintained.** Dependencies are pinned at their November 2026 versions and GitHub reports one moderate advisory.

## What I would do next

- Bring my CV and cover letter agents into the dashboard, so that a vacancy leads straight to a tailored draft.
- Send a daily summary of new vacancies and the status of open applications.
- Read more email languages and more sources, for example LinkedIn's recommendation emails.
- Detect the same vacancy across sources and merge them.
- Add paging to the vacancy list and a compact action menu in the Applied tab.

## Repository map

| Folder | What is in it |
| --- | --- |
| `src/app` | Pages, tables and actions |
| `src/lib` | Sync, parsers, Gmail, Greenhouse, vacancy actions and helpers |
| `scripts` | Token helper, board probe and board import |
| `docs/sql` | Database schema |
| `docs/build-log` | The plan for each epic |
| `docs/agents` | The Claude agents for CV and cover letter |
| `docs/BACKLOG.md` | Ideas and findings I put off |

## License

MIT, see [LICENSE](LICENSE).
