# Job Hunting Dashboard
Next.js (App Router, TypeScript), Supabase, Vercel. Ingests LinkedIn job-alert emails from Gmail.

## Rules
- Never read, print or log values from .env.local. Refer to variables by name only.
- Never run schema-changing or destructive SQL. Write it to a file and the owner runs it manually.
- One concern per commit. Unrelated changes go in separate commits.
- Anything touching real data is tested on a Vercel Preview deploy before merging.
- Build parsers only against real sample emails stored in the repo, never a guessed format.
- Deferred ideas go in BACKLOG.md, not into the current task.
- Claude Code reads only samples/linkedin-clean/, never the raw .eml files.
