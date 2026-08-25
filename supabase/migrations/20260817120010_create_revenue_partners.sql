-- Đối tác doanh thu liên kết
create table if not exists public.revenue_partners (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  partner_type text
    constraint revenue_partners_partner_type_check check (
      partner_type is null or partner_type in ('insurance', 'finance', 'bhxh', 'wallet')
    ),
  logo_url text,
  affiliate_url text,
  commission_pct numeric(5, 2),
  click_count integer not null default 0,
  lead_count integer not null default 0,
  revenue_vnd integer not null default 0,
  is_active boolean not null default true
);

create index if not exists revenue_partners_is_active_idx on public.revenue_partners (is_active);
