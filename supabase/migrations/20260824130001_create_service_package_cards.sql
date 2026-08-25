-- Nội dung các thẻ hiển thị ở trang "Dịch vụ trọn gói".
create table if not exists public.service_package_cards (
  id uuid primary key default gen_random_uuid(),
  icon text not null default '🎯',
  title text not null unique,
  description text not null,
  features text[] not null default '{}',
  price text not null,
  cta_label text not null default 'Tư vấn ngay',
  accent text not null default 'orange'
    constraint service_package_cards_accent_check check (accent in ('orange', 'green', 'amber', 'red', 'full')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_package_cards_active_sort_idx
  on public.service_package_cards (is_active, sort_order);

alter table public.service_package_cards enable row level security;

create policy "service_package_cards_public_read_active" on public.service_package_cards
  for select
  to anon, authenticated
  using (is_active = true);

-- Seed đúng 6 thẻ đang có trong giao diện HTML demo.
insert into public.service_package_cards (
  icon, title, description, features, price, cta_label, accent, sort_order
)
values
  (
    '🎯',
    'Tuyển dụng theo yêu cầu (RPO)',
    'Thay vì đăng tin tự quản, đội ngũ ViecLamCongNhan.com chủ động tìm kiếm, sàng lọc và cung cấp danh sách ứng viên đạt tiêu chuẩn. Phù hợp khi cần tuyển gấp số lượng lớn.',
    array['Đăng tin + chủ động tiếp cận ứng viên trong vùng KCN mục tiêu', 'Sàng lọc hồ sơ theo tiêu chí doanh nghiệp', 'Tổ chức ngày phỏng vấn tại chỗ hoặc online', 'Cam kết tỉ lệ ứng viên đạt yêu cầu ≥ 80%'],
    'Từ 3.000.000đ / chiến dịch', 'Tư vấn ngay', 'orange', 1
  ),
  (
    '📋',
    'Hợp đồng lao động & Hồ sơ nhân sự',
    'Soạn thảo và kiểm tra hợp đồng lao động đúng luật, phù hợp đặc thù công nhân nhà máy. Lưu trữ hồ sơ số hóa, tra cứu nhanh.',
    array['Soạn thảo HĐLĐ chuẩn theo ngành sản xuất', 'Kiểm tra tính hợp pháp trước khi ký', 'Số hóa hồ sơ toàn bộ nhân sự', 'Cảnh báo hợp đồng sắp hết hạn'],
    'Từ 500.000đ / 10 hợp đồng', 'Tư vấn ngay', 'orange', 2
  ),
  (
    '🏥',
    'Đăng ký BHXH · BHYT · BHTN',
    'Phối hợp DichVuThue.net xử lý toàn bộ thủ tục đăng ký bảo hiểm cho nhân viên mới, tăng/giảm lao động, quyết toán năm.',
    array['Đăng ký BHXH cho công nhân mới tuyển', 'Xử lý tăng/giảm lao động hàng tháng', 'Báo cáo BHXH định kỳ cho cơ quan BHXH', 'Hỗ trợ giải quyết chế độ ốm đau, thai sản'],
    'Từ 200.000đ / người / năm', 'Tư vấn ngay', 'green', 3
  ),
  (
    '💰',
    'Khai thuế TNCN cho công nhân',
    'Phối hợp DichVuThue.net khai và quyết toán thuế TNCN cho toàn bộ công nhân — đúng hạn, không phát sinh phạt.',
    array['Khai thuế TNCN hàng tháng/quý', 'Quyết toán thuế TNCN năm cho từng CN', 'Tư vấn giảm trừ gia cảnh hợp pháp', 'Đại diện nộp hồ sơ tại cơ quan thuế'],
    'Từ 150.000đ / người / tháng', 'Tư vấn ngay', 'amber', 4
  ),
  (
    '⚖️',
    'Tư vấn & Xử lý pháp lý lao động',
    'Phối hợp VEA Law xử lý tranh chấp lao động, kỷ luật sa thải, khiếu nại, khởi kiện — bảo vệ quyền lợi cả hai phía.',
    array['Tư vấn quy trình kỷ luật, sa thải đúng luật', 'Soạn thảo nội quy lao động', 'Xử lý khiếu nại, tranh chấp lao động', 'Đại diện tại Hội đồng trọng tài lao động'],
    'Từ 500.000đ / giờ tư vấn', 'Liên hệ VEA Law', 'red', 5
  ),
  (
    '⚡',
    'Gói Full-Package (Trọn gói)',
    'Kết hợp toàn bộ 5 dịch vụ trên — 1 đầu mối, 1 hóa đơn, 1 account manager. Tiết kiệm 30% so với mua riêng lẻ.',
    array['Tuyển dụng theo yêu cầu', 'Hợp đồng + Hồ sơ nhân sự', 'BHXH + Thuế TNCN', 'Pháp lý lao động'],
    'Liên hệ nhận báo giá', 'Nhận báo giá ngay', 'full', 6
  )
on conflict (title) do nothing;
