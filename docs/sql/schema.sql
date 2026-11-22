-- Core schema for the Job Hunting Dashboard.
--
-- Run this once in the Supabase SQL editor of your own project, then run
-- docs/sql/epic-12-board-registry.sql to add the board registry.
--
-- This file was reconstructed from the application code and the build log after the
-- original Supabase project was paused. It is not an export of that project.
-- It was checked against a local Postgres by running every insert shape the code
-- produces, but it has not been run against a live Supabase project.
--
-- The app only ever uses the service_role key. Row level security is on and the
-- other roles get nothing. vacancy_actions and sync_runs are append-only.

-- Vacancies found by a sync, from LinkedIn alert emails or Greenhouse boards.
create table public.vacancies (
  id                bigint generated always as identity primary key,
  source            text not null check (source in ('linkedin', 'greenhouse')),
  source_job_id     text not null,
  title             text not null,
  company           text not null,
  location          text,
  url               text not null,
  first_seen_at     timestamptz not null default now(),
  source_message_id text,
  sync_run_id       uuid,
  -- The sync upserts with ON CONFLICT (source, source_job_id) DO NOTHING.
  unique (source, source_job_id)
);

create index vacancies_sync_run_id_idx on public.vacancies (sync_run_id);
create index vacancies_first_seen_at_idx on public.vacancies (first_seen_at desc, id desc);

-- Append-only log of what the owner did with a vacancy. A vacancy's current status is
-- derived from its latest status row and is never stored.
create table public.vacancy_actions (
  id            bigint generated always as identity primary key,
  vacancy_id    bigint not null references public.vacancies (id),
  action        text not null check (action in (
                  'applied', 'ignored', 'reset', 'rejected', 'success',
                  'starred', 'unstarred',
                  'automated_draft', 'automated_draft_cleared', 'automated_draft_done',
                  'pilot', 'pilot_cleared'
                )),
  ignore_reason text check (ignore_reason in ('language', 'interest', 'seniority', 'duplicate', 'other')),
  applied_on    date,
  outcome_on    date,
  created_at    timestamptz not null default now(),
  -- Each action only carries the fields that belong to it.
  check (ignore_reason is null or action = 'ignored'),
  check ((action = 'applied') = (applied_on is not null)),
  check ((action in ('rejected', 'success')) = (outcome_on is not null))
);

create index vacancy_actions_vacancy_id_idx on public.vacancy_actions (vacancy_id, id);

-- One row per sync run, written when the run finishes.
create table public.sync_runs (
  id                   bigint generated always as identity primary key,
  run_id               uuid,
  trigger              text not null check (trigger in ('cron', 'manual')),
  status               text not null check (status in ('ok', 'error')),
  started_at           timestamptz not null,
  finished_at          timestamptz not null,
  messages             integer not null default 0,
  cards                integer not null default 0,
  unique_jobs          integer not null default 0,
  inserted             integer not null default 0,
  skipped              integer not null default 0,
  warnings             integer not null default 0,
  parser_failure_count integer not null default 0,
  source_results       jsonb,
  parser_failures      jsonb not null default '[]'::jsonb,
  failures             jsonb not null default '[]'::jsonb,
  warning_details      jsonb not null default '[]'::jsonb,
  error                text
);

create unique index sync_runs_run_id_key on public.sync_runs (run_id);

alter table public.vacancies enable row level security;
alter table public.vacancy_actions enable row level security;
alter table public.sync_runs enable row level security;

revoke all on public.vacancies, public.vacancy_actions, public.sync_runs
  from public, anon, authenticated, service_role;

grant select, insert on public.vacancies, public.vacancy_actions, public.sync_runs to service_role;
