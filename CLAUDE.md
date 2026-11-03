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
- Design tokens (colours, radii, content width) live in `src/app/globals.css` under `:root`/`@theme inline`. No hard-coded colours in components — use the tokens.
- Dark theme only, desktop only. No light-mode toggle, no responsive breakpoints.

For any coding task, follow the Ponytail ruleset. Write the least code that works and reuse existing code first.
Before finishing a feature, run /ponytail:ponytail-review on the diff and report what to delete.
Keep replies to me terse following the caveman ruleset. Answer first, no filler, keep all technical facts.

- Use the jordy-ui package for shared components and tokens. Do not copy or re-create them.
- No hard-coded hex colours. Use the tokens from jordy-ui.
- Never edit shared components inside this project. Changes go in the jordy-design-system repo.