# Backlog

- Create the `/privacy` page. It's linked in the Google OAuth consent screen branding and currently 404s.
- Review the `npm audit` warnings (5 high). Do not run `npm audit fix --force` — check each advisory individually first.
- Consider ingesting `jobs-noreply@linkedin.com` recommendation emails later. Different layout from the job-alert emails; out of scope for MVP.
- Store the saved search per vacancy (deferred 5 Oct).
- /api/sync discards per-card parse failures (ParseResult.failures) rather than surfacing a count; only `warnings` is exposed today. Consider adding a `parseFailures` count to the sync response (deferred 5 Oct).
