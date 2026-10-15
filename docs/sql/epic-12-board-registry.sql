-- Epic 12: board registry. Run once, in order.

create table public.boards (
  id           bigint generated always as identity primary key,
  portal       text not null check (portal in ('greenhouse', 'lever', 'ashby', 'breezy')),
  identifier   text not null,
  display_name text not null,
  created_at   timestamptz not null default now(),
  unique (portal, identifier),
  unique (portal, display_name)
);

create table public.board_checks (
  id         bigint generated always as identity primary key,
  board_id   bigint not null references public.boards (id),
  status     text not null check (status in ('active', 'empty', 'not_found', 'dead')),
  job_count  integer check (job_count is null or job_count >= 0),
  checked_at timestamptz not null default now()
);

create index board_checks_board_id_idx on public.board_checks (board_id, id desc);

alter table public.boards enable row level security;
alter table public.board_checks enable row level security;

revoke all on public.boards, public.board_checks from public, anon, authenticated, service_role;
grant select, insert on public.boards, public.board_checks to service_role;

-- The three boards that are live today. Names must match vacancies.company.
-- No check rows on purpose: a board with no check row counts as active.
insert into public.boards (portal, identifier, display_name) values
  ('greenhouse', 'bybit',    'Bybit'),
  ('greenhouse', 'binance',  'Binance'),
  ('greenhouse', 'xendit',   'Xendit')
on conflict do nothing;

-- Check query. Run separately, after the SQL above.
-- Expected: 24 privilege rows; only service_role SELECT and INSERT show ok = true
-- (4 true in total); both rls: rows show ok = true.

select 'boards' as tbl, r.role_name, p.priv,
       has_table_privilege(r.role_name, 'public.boards', p.priv) as ok
from unnest(array['anon', 'authenticated', 'service_role']) as r(role_name)
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(priv)
union all
select 'board_checks', r.role_name, p.priv,
       has_table_privilege(r.role_name, 'public.board_checks', p.priv)
from unnest(array['anon', 'authenticated', 'service_role']) as r(role_name)
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(priv)
union all
select 'rls:' || relname, '-', 'ROW LEVEL SECURITY', relrowsecurity
from pg_class
where oid in ('public.boards'::regclass, 'public.board_checks'::regclass)
order by 1, 2, 3;
