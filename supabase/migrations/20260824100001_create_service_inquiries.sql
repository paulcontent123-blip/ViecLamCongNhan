-- Yêu cầu tư vấn dịch vụ trọn gói gửi từ trang công khai.
create table if not exists public.service_inquiries (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  company_name text not null,
  phone text not null,
  email text not null,
  request text not null,
  status text not null default 'new'
    constraint service_inquiries_status_check check (status in ('new', 'consulted')),
  created_at timestamptz not null default now(),
  consulted_at timestamptz
);

create index if not exists service_inquiries_status_idx on public.service_inquiries (status);
create index if not exists service_inquiries_created_at_idx on public.service_inquiries (created_at desc);

alter table public.service_inquiries enable row level security;
