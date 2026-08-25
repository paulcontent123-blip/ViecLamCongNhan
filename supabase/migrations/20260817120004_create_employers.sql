-- Nhà tuyển dụng
create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users (id) on delete cascade,
  company_name text not null,
  company_slug text unique not null,
  company_logo_url text,
  industry text
    constraint employers_industry_check check (
      industry is null or industry in ('may_mac', 'dien_tu', 'co_khi', 'thuc_pham', 'hoa_chat')
    ),
  province_code text not null,
  tax_code text,
  contact_phone text not null,
  is_verified boolean not null default false, -- admin xác minh pháp nhân
  account_type text not null default 'basic'
    constraint employers_account_type_check check (account_type in ('basic', 'featured', 'enterprise')),
  created_at timestamptz not null default now()
);

comment on column public.employers.is_verified is 'Admin xác minh pháp nhân (tax_code, giấy phép...) trước khi cho đăng tin trả phí.';

create index if not exists employers_province_code_idx on public.employers (province_code);
create index if not exists employers_company_slug_idx on public.employers (company_slug);
