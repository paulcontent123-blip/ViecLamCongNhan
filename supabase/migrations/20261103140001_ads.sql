-- Quảng cáo do Admin quản lý (bán theo hướng tư vấn, chốt ngoài hệ thống): hệ thống chỉ lưu nội dung, nơi hiển thị và thời hạn.
-- Chạy TRƯỚC khi deploy web: các route /api/mobile/admin/ads, /api/mobile/ads và các trang web đọc bảng này.
--   placement   : homepage_banner (trang chủ), sidebar (cột bên trang Tìm việc, chỉ web), kcn_banner (banner theo KCN, 1 KCN hoặc gói 5 KCN),
--                 service_card (card nhà trọ/dịch vụ theo 1 KCN, có thể gắn nhãn HOT và luôn xếp đầu danh sách).
--   kcn_ids     : các KCN quảng cáo áp dụng; rỗng với homepage_banner và sidebar.
--   show_on_web / show_on_app : kênh hiển thị khách đã mua; sidebar chỉ có trên web.
--   starts_on / ends_on : ngày bắt đầu và kết thúc (tính theo giờ Việt Nam, gồm cả hai ngày); hết hạn thì tự ngừng hiển thị, không cần Admin gỡ.
--   customer_note : ghi chú nội bộ của Admin (khách, gói, giá đã chốt); không bao giờ trả ra API công khai.
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  placement text not null
    constraint ads_placement_check check (placement in ('homepage_banner', 'sidebar', 'kcn_banner', 'service_card')),
  title text not null
    constraint ads_title_check check (char_length(btrim(title)) between 3 and 100),
  body text
    constraint ads_body_check check (body is null or char_length(body) <= 300),
  image_url text
    constraint ads_image_url_check check (image_url is null or (image_url like 'https://%' and char_length(image_url) <= 500)),
  link_url text
    constraint ads_link_url_check check (link_url is null or ((link_url like 'https://%' or link_url like 'tel:%') and char_length(link_url) <= 500)),
  is_hot boolean not null default false,
  kcn_ids uuid[] not null default '{}',
  show_on_web boolean not null default true,
  show_on_app boolean not null default true,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active'
    constraint ads_status_check check (status in ('active', 'paused')),
  customer_note text
    constraint ads_customer_note_check check (customer_note is null or char_length(customer_note) <= 500),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_dates_check check (ends_on >= starts_on),
  constraint ads_channel_check check (show_on_web or show_on_app),
  constraint ads_sidebar_web_only_check check (placement <> 'sidebar' or (show_on_web and not show_on_app)),
  constraint ads_hot_card_only_check check (not is_hot or placement = 'service_card'),
  constraint ads_kcn_count_check check (
    (placement in ('homepage_banner', 'sidebar') and cardinality(kcn_ids) = 0)
    or (placement = 'kcn_banner' and cardinality(kcn_ids) between 1 and 5)
    or (placement = 'service_card' and cardinality(kcn_ids) = 1)
  ),
  -- Banner và sidebar cần ảnh; card có thể chỉ có chữ.
  constraint ads_image_required_check check (placement = 'service_card' or image_url is not null)
);

create index if not exists ads_placement_dates_idx on public.ads (placement, status, starts_on, ends_on);

-- Chỉ service_role (route phía server) đọc và ghi; người dùng không truy cập bảng trực tiếp.
alter table public.ads enable row level security;
revoke all on public.ads from public, anon, authenticated;
grant select, insert, update, delete on public.ads to service_role;
