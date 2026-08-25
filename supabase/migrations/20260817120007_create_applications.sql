-- Đơn ứng tuyển
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs (id) on delete cascade,
  candidate_id uuid references public.candidates (id) on delete cascade,
  employer_id uuid references public.employers (id) on delete cascade,
  cover_note text,
  status text not null default 'new'
    constraint applications_status_check check (status in ('new', 'viewed', 'contacted', 'rejected', 'hired')),
  created_at timestamptz not null default now()
);

create index if not exists applications_job_id_idx on public.applications (job_id);
create index if not exists applications_candidate_id_idx on public.applications (candidate_id);
create index if not exists applications_employer_id_idx on public.applications (employer_id);
create unique index if not exists applications_job_candidate_unique on public.applications (job_id, candidate_id);
