-- Tin tuyển dụng
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references public.employers (id) on delete cascade,
  slug text unique not null,
  title text not null,
  description text not null,
  requirements text,
  salary_min integer, -- VNĐ/tháng
  salary_max integer,
  job_type text
    constraint jobs_job_type_check check (job_type is null or job_type in ('full_time', 'part_time', 'seasonal')),
  province_code text not null,
  district text,
  kcn_id uuid references public.kcn (id) on delete set null,
  industry text not null,
  quantity integer not null default 1,
  tier text not null default 'free'
    constraint jobs_tier_check check (tier in ('free', 'basic', 'featured', 'campaign')),
  status text not null default 'pending'
    constraint jobs_status_check check (status in ('pending', 'approved', 'closed', 'expired')),
  sms_blast_sent boolean not null default false,
  view_count integer not null default 0,
  apply_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint jobs_salary_range_check check (
    salary_min is null or salary_max is null or salary_min <= salary_max
  )
);

create index if not exists jobs_employer_id_idx on public.jobs (employer_id);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_province_code_idx on public.jobs (province_code);
create index if not exists jobs_kcn_id_idx on public.jobs (kcn_id);
create index if not exists jobs_industry_idx on public.jobs (industry);
create index if not exists jobs_tier_idx on public.jobs (tier);
-- Filter chính của trang Tìm việc làm: tỉnh + trạng thái + ngành
create index if not exists jobs_search_idx on public.jobs (status, province_code, industry);
