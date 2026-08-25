-- Khu Công nghiệp Directory
create table if not exists public.kcn (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province_code text not null,
  province_name text not null,
  address text,
  total_area_ha numeric(10, 2),
  occupied_pct numeric(5, 2),
  active_companies integer not null default 0,
  active_jobs integer not null default 0,
  industries text[],
  lat numeric(10, 7),
  lng numeric(10, 7),
  created_at timestamptz not null default now()
);

create index if not exists kcn_province_code_idx on public.kcn (province_code);
