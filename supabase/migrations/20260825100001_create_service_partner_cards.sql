-- Nội dung các thẻ hiển thị ở tab "Đối tác dịch vụ".
create table if not exists public.service_partner_cards (
  id uuid primary key default gen_random_uuid(),
  icon text not null default '🤝',
  icon_bg text not null default 'emerald',
  title text not null unique,
  category text not null default '',
  tag text not null default 'Đối tác dịch vụ',
  tag_tone text not null default 'ins',
  description text not null,
  package_lines text[] not null default '{}',
  cta_label text not null default 'Xem chi tiết',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_partner_cards_active_sort_idx
  on public.service_partner_cards (is_active, sort_order);

alter table public.service_partner_cards enable row level security;

create policy "service_partner_cards_public_read_active" on public.service_partner_cards
  for select
  to anon, authenticated
  using (is_active = true);

-- Seed đúng các thẻ đối tác dịch vụ trong file HTML demo.
insert into public.service_partner_cards (
  icon, icon_bg, title, category, tag, tag_tone, description, package_lines, cta_label, sort_order
)
values
  (
    '🛡', 'emerald', 'FWD Bảo hiểm', 'Bảo hiểm nhân thọ', 'Bảo hiểm', 'ins',
    'Bảo hiểm ung thư, tai nạn mua online không cần khám sức khỏe. Phù hợp công nhân thu nhập thấp với mức phí chỉ từ 99.000đ/năm.',
    array['BH Bệnh ung thư: từ 99.000đ/năm', 'BH Tai nạn lao động: từ 150.000đ/năm', 'BH Sức khỏe: từ 300.000đ/năm', 'Hoa hồng affiliate: 50.000–150.000đ/hợp đồng'],
    'Xem gói bảo hiểm', 1
  ),
  (
    '🛡', 'emerald', 'Prudential Vietnam', 'Bảo hiểm nhân thọ', 'Bảo hiểm', 'ins',
    'Gói bảo hiểm tai nạn 24/7 chi phí thấp, phù hợp lao động sản xuất. PRU-Bảo vệ 24/7 từ 1.000đ/ngày (365.000đ/năm) — không cần khám.',
    array['PRU-Bảo vệ 24/7: 365.000đ/năm', 'PRU-Easy365: tai nạn + bệnh nguy hiểm', 'PRU-Nhiệt Đới: sốt xuất huyết 80.000đ/năm', 'Hoa hồng affiliate: 80.000–200.000đ/HĐ'],
    'Xem gói bảo hiểm', 2
  ),
  (
    '🛡', 'emerald', 'Bảo Việt Nhân thọ', 'Bảo hiểm nhân thọ', 'Bảo hiểm', 'ins',
    'Bảo hiểm tai nạn cá nhân 24/7 với STBH 50 triệu, chi phí y tế tai nạn 10 triệu. Giá từ 150.000đ/năm — phù hợp tệp công nhân.',
    array['BH Tai nạn CN 24/7: 150.000đ/năm', 'BH Sức khỏe cá nhân: từ 42.000đ', 'BH Du lịch nội địa: từ 17.000đ/chuyến', 'Hoa hồng affiliate: 50.000–120.000đ/HĐ'],
    'Xem gói bảo hiểm', 3
  ),
  (
    '💵', 'orange', 'Tima.vn', 'Tài chính tiêu dùng', 'Vay tiêu dùng', 'fin',
    'Nền tảng vay tiêu dùng phổ biến với công nhân. Vay 1–50 triệu, giải ngân trong ngày, không cần tài sản thế chấp. Chỉ cần CMND + xác minh thu nhập.',
    array['Vay 1–50 triệu: lãi suất từ 1.5%/tháng', 'Giải ngân trong 24 giờ', 'Chỉ cần CMND + hợp đồng lao động', 'Hoa hồng affiliate: 100.000–200.000đ/lead'],
    'Xem gói vay', 4
  ),
  (
    '💵', 'orange', 'MCredit', 'MB Finance · Tài chính tiêu dùng', 'Vay tiêu dùng', 'fin',
    'Thành viên MB Group. Vay lương công nhân nhanh 5–70 triệu. Quy trình online, duyệt nhanh, lãi suất cạnh tranh so với tín dụng đen.',
    array['Vay 5–70 triệu: lãi từ 1.8%/tháng', 'Duyệt hồ sơ trong 30 phút', 'Không cần thế chấp, không cần lịch sử tín dụng', 'Hoa hồng affiliate: 150.000–250.000đ/lead'],
    'Xem gói vay', 5
  ),
  (
    '💵', 'orange', 'SHB Finance', 'Vay tiêu dùng · Ngân hàng SHB', 'Vay tiêu dùng', 'fin',
    'Cho vay tiêu dùng dành cho công nhân có hợp đồng lao động. Thủ tục đơn giản, phê duyệt nhanh. Lãi suất ưu đãi hơn các app vay không chính thống.',
    array['Vay 3–100 triệu: lãi từ 1.6%/tháng', 'HĐLĐ còn hiệu lực là đủ điều kiện', 'Kỳ hạn 12–60 tháng', 'Hoa hồng affiliate: 120.000–200.000đ/lead'],
    'Xem gói vay', 6
  ),
  (
    '📱', 'purple', 'Ví MoMo', 'Thanh toán điện tử', 'Ví điện tử', 'dig',
    'Nhận lương qua MoMo, chuyển tiền về quê miễn phí, thanh toán tiền nhà trọ và mua sắm không cần tài khoản ngân hàng. Phù hợp công nhân ngoại tỉnh.',
    array['Kích hoạt ví miễn phí', 'Chuyển tiền nội địa: 0đ phí', 'Nhận lương không cần tài khoản ngân hàng', 'Hoa hồng affiliate: 30.000–80.000đ/kích hoạt'],
    'Hướng dẫn kích hoạt', 7
  ),
  (
    '💬', 'purple', 'ZaloPay', 'Thanh toán · Zalo ecosystem', 'Ví điện tử', 'dig',
    'Thanh toán tiền nhà trọ, mua đồ ăn, chuyển tiền về quê ngay trong ứng dụng Zalo — không cần cài thêm app. Phù hợp nhất vì công nhân đã dùng Zalo sẵn.',
    array['Kích hoạt trong 2 phút qua Zalo', 'Liên kết trực tiếp ngân hàng hoặc không cần tài khoản', 'Ưu đãi hoàn tiền định kỳ', 'Hoa hồng affiliate: 20.000–60.000đ/kích hoạt'],
    'Hướng dẫn kích hoạt', 8
  ),
  (
    '🏛', 'amber', 'BHXH Tự nguyện', 'Bảo hiểm xã hội Nhà nước', 'BHXH Nhà nước', 'pension',
    'Công nhân làm việc tự do hoặc hết HĐLĐ có thể đóng BHXH tự nguyện để nhận lương hưu. Từ 1/7/2025 có thêm quyền lợi thai sản. Nhà nước hỗ trợ 30% mức đóng tối thiểu.',
    array['Mức đóng tối thiểu: ~515.000đ/tháng', 'Hỗ trợ nhà nước: 30% (hộ nghèo 100%)', 'Quyền lợi: lương hưu + thai sản (từ 7/2025)', 'Đăng ký qua cổng BHXH hoặc đại lý'],
    'Tìm hiểu đăng ký', 9
  ),
  (
    '📈', 'amber', 'Quỹ Hưu trí Bổ sung', 'DCVFM · VCBF · SSI · MBC', 'Đầu tư hưu trí', 'pension',
    'Quỹ hưu trí bổ sung tự nguyện theo NĐ 85/2026. Đầu tư thêm ngoài BHXH bắt buộc. Ưu đãi thuế TNCN. 4 quỹ đã được cấp phép: DCVFM, VCBF, SSI, MBC.',
    array['Mức đóng: linh hoạt tự chọn', 'Đầu tư 40%+ vào trái phiếu CP', 'Ưu đãi thuế TNCN theo quy định', 'Hoa hồng affiliate: 50.000–100.000đ/tài khoản'],
    'Tìm hiểu đăng ký', 10
  )
on conflict (title) do nothing;
