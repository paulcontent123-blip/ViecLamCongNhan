-- Người dùng & Xác thực
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text unique, -- SĐT là primary ID cho công nhân
  password_hash text, -- NULL cho employer ở giai đoạn chưa bật xác thực (xem README)
  full_name text not null,
  role text not null default 'candidate'
    constraint users_role_check check (role in ('candidate', 'employer', 'agency', 'admin')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.users is 'Tài khoản người dùng: candidate | employer | agency | admin';
comment on column public.users.password_hash is 'bcrypt hash. Bắt buộc cho role=admin, tùy chọn cho employer ở giai đoạn hiện tại.';

create index if not exists users_role_idx on public.users (role);
