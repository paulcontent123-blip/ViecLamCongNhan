-- Ứng viên (form nhanh)
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  zalo text,
  province text,
  desired_industry text,
  desired_salary_min integer,
  experience_years integer,
  status text not null default 'new'
    constraint candidates_status_check check (status in ('new', 'contacted', 'hired', 'inactive')),
  source text not null default 'quick_form',
  created_at timestamptz not null default now()
);

create index if not exists candidates_status_idx on public.candidates (status);
create index if not exists candidates_phone_idx on public.candidates (phone);
