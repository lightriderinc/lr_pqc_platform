-- qSearch scan history. Run once in the Supabase SQL editor.
--
-- Only the website's server reads and writes this table, with the service
-- role key, and every query is filtered by owner_id there. Row level security
-- is enabled with no policies, so the public anon key can read nothing.

create table if not exists public.qsearch_scans (
  id uuid primary key default gen_random_uuid(),
  -- Logto user id (the sub claim).
  owner_id text not null,
  -- Scans of the same project are compared with each other.
  project text not null,
  file_name text not null,
  created_at timestamptz not null default now(),
  files_scanned integer not null,
  quantum_vulnerable integer not null,
  high_risk integer not null,
  pqc_ready integer not null,
  findings jsonb not null,
  reports jsonb not null,
  -- Details of the information system for the federal inventory, entered
  -- by the user (src/lib/qsearch/inventory.ts).
  system jsonb
);

-- For tables created before the system column existed.
alter table public.qsearch_scans add column if not exists system jsonb;

create index if not exists qsearch_scans_owner_created_idx
  on public.qsearch_scans (owner_id, created_at desc);

create index if not exists qsearch_scans_owner_project_created_idx
  on public.qsearch_scans (owner_id, project, created_at desc);

alter table public.qsearch_scans enable row level security;
revoke all on public.qsearch_scans from anon, authenticated;