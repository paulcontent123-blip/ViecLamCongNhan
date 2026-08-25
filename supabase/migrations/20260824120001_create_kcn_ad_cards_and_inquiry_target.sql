-- KCN/Tỉnh mà doanh nghiệp muốn nhắm tới khi gửi yêu cầu quảng cáo.
alter table public.service_inquiries
  add column if not exists kcn_target text;

-- Nội dung các thẻ hiển thị ở tab "Quảng cáo theo KCN".
create table if not exists public.kcn_ad_cards (
  id uuid primary key default gen_random_uuid(),
  icon text not null default '📍',
  icon_bg text not null default 'orange',
  title text not null unique,
  category text not null default '',
  tag text not null default 'KCN target',
  tag_tone text not null default 'ins',
  description text not null,
  package_lines text[] not null default '{}',
  cta_label text not null default 'Đặt quảng cáo',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kcn_ad_cards_active_sort_idx on public.kcn_ad_cards (is_active, sort_order);

alter table public.kcn_ad_cards enable row level security;

create policy "kcn_ad_cards_public_read_active" on public.kcn_ad_cards
  for select
  to anon, authenticated
  using (is_active = true);

-- Seed đúng 6 thẻ theo file HTML demo. Admin có thể sửa nội dung sau khi migration chạy.
insert into public.kcn_ad_cards (
  icon, icon_bg, title, category, tag, tag_tone, description, package_lines, cta_label, sort_order
)
values
  (
    '🏠', 'emerald', 'Nhà trọ công nhân', 'Bất động sản · Dịch vụ lưu trú', 'KCN target', 'ins',
    'Chủ nhà trọ gần KCN quảng cáo đến công nhân đang tìm việc tại khu vực. Hiển thị card trong trang KCN + job detail khi ứng viên xem tin có trường "cần nhà ở".',
    array['Card nhà trọ: 300.000đ/tháng/KCN', 'Bundle 5 KCN: 1.200.000đ/tháng', 'Kèm SĐT hiển thị trực tiếp'],
    'Đặt quảng cáo', 1
  ),
  (
    '🍱', 'orange', 'Canteen & Cơm ca', 'Thực phẩm · Ẩm thực KCN', 'KCN target', 'ins',
    'Dịch vụ cơm ca, đồ ăn giao đến cổng KCN quảng cáo đến công nhân. Hiển thị trong trang KCN và mục "Quyền lợi CN".',
    array['Banner KCN: 500.000đ/tháng/KCN', 'Card dịch vụ: 300.000đ/tháng', 'Kèm Zalo/SĐT đặt hàng'],
    'Đặt quảng cáo', 2
  ),
  (
    '🛒', 'purple', 'Siêu thị & Tạp hóa', 'Bán lẻ · Hàng tiêu dùng', 'KCN target', 'ins',
    'Siêu thị mini, cửa hàng tiện lợi gần KCN quảng cáo sản phẩm và ưu đãi dành cho công nhân.',
    array['Card dịch vụ: 300.000đ/tháng', 'Banner sidebar: 500.000đ/tháng', 'Toàn site hoặc theo KCN'],
    'Đặt quảng cáo', 3
  ),
  (
    '🛵', 'emerald', 'Xe ôm & Đưa đón KCN', 'Vận chuyển · Di chuyển', 'KCN target', 'ins',
    'Dịch vụ xe ôm, xe hợp đồng đưa đón công nhân đi làm ca. Target theo tuyến đường và KCN cụ thể.',
    array['Card dịch vụ: 300.000đ/tháng', 'Hiển thị SĐT/Zalo liên hệ', 'Target theo tỉnh + KCN'],
    'Đặt quảng cáo', 4
  ),
  (
    '🏪', 'amber', 'Quảng cáo toàn site', 'Sidebar · Banner trang chủ', 'Toàn site', 'dig',
    'Banner sidebar hoặc spot homepage hiển thị toàn bộ site — phù hợp với thương hiệu muốn tiếp cận rộng tệp lao động phổ thông toàn quốc.',
    array['Sidebar spot: 800.000đ/tháng', 'Banner homepage: 1.500.000đ/tháng', 'Hiển thị 100% trang toàn site'],
    'Đặt quảng cáo', 5
  ),
  (
    '📊', 'indigo', 'Blast SMS/Zalo đến CN', 'Direct Marketing · Database', 'Database', 'dig',
    'Đối tác muốn gửi tin trực tiếp đến công nhân trong database — nhà trọ, khuyến mãi, dịch vụ. Phí theo lượt gửi, target theo tỉnh/KCN.',
    array['SMS: 500đ/tin (tối thiểu 500 tin)', 'Zalo OA: 300đ/tin', 'Target theo tỉnh + ngành'],
    'Tạo chiến dịch Blast', 6
  )
on conflict (title) do nothing;
