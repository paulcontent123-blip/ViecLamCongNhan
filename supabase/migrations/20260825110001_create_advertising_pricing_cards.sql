-- Các dòng trong tab "Bảng giá quảng cáo" và dữ liệu dùng để quản lý trên Admin.
create table if not exists public.advertising_pricing_cards (
  id uuid primary key default gen_random_uuid(),
  format text not null unique,
  placement text not null,
  price text not null,
  unit text not null,
  cta_label text not null default 'Đặt ngay',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advertising_pricing_cards_active_sort_idx
  on public.advertising_pricing_cards (is_active, sort_order);

alter table public.advertising_pricing_cards enable row level security;

create policy "advertising_pricing_cards_public_read_active" on public.advertising_pricing_cards
  for select
  to anon, authenticated
  using (is_active = true);

insert into public.advertising_pricing_cards (format, placement, price, unit, cta_label, sort_order)
values
  ('Banner KCN', 'Trang KCN + Job list của KCN', '800.000đ', '1 KCN · 30 ngày', 'Đặt ngay', 1),
  ('Bundle 5 KCN', '5 KCN tự chọn', '2.500.000đ', '5 KCN · 30 ngày', 'Đặt ngay', 2),
  ('Card nhà trọ / dịch vụ', 'Trang KCN + Job detail', '300.000đ', '1 KCN · 30 ngày', 'Đặt ngay', 3),
  ('Sidebar toàn site', 'Sidebar trang Tìm việc', '800.000đ', '30 ngày · Toàn site', 'Đặt ngay', 4),
  ('Banner Homepage', 'Trang chủ · vị trí nổi bật', '1.500.000đ', '30 ngày', 'Đặt ngay', 5)
on conflict (format) do nothing;
