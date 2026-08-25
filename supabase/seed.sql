-- Dữ liệu khởi tạo cho môi trường dev/local.
-- Chạy: supabase db seed  (hoặc psql -f supabase/seed.sql khi đã link project)

-- ============================================================
-- Admin account — được cấp/tạo trực tiếp trên database (không tự đăng ký).
-- Mật khẩu tạm: ThayDoiMatKhauNay!2026 — ĐỔI NGAY và xoá dòng comment này
-- trước khi đưa lên production. Tạo hash mới bằng:
--   node -e "console.log(require('bcryptjs').hashSync('mat_khau_moi', 10))"
-- ============================================================
insert into public.users (email, full_name, role, password_hash, is_verified)
values (
  'admin@vieclamcongnhan.com',
  'Quản trị viên VEA',
  'admin',
  '$2a$12$VBZ1kklaVrCquR22r2vAS.zug7EuPohNWSwi.nywb51QzMrobXTGm', --@Veamedia
  true
)
on conflict (email) do nothing;

-- ============================================================
-- KCN mẫu (một vài KCN thật để dev/test — chưa phải đủ 300+ theo mục tiêu TechSpec)
-- ============================================================
insert into public.kcn (name, province_code, province_name, address, total_area_ha, occupied_pct, active_companies, active_jobs, industries, lat, lng)
values
  ('KCN Bắc Thăng Long', 'HN', 'Hà Nội', 'Đông Anh, Hà Nội', 302.0, 96.5, 98, 210, array['dien_tu','co_khi'], 21.1300, 105.7600),
  ('KCN VSIP Bắc Ninh', 'BN', 'Bắc Ninh', 'Từ Sơn, Bắc Ninh', 700.0, 89.0, 145, 380, array['dien_tu','may_mac'], 21.1200, 105.9700),
  ('KCN Amata Đồng Nai', 'DN', 'Đồng Nai', 'Biên Hòa, Đồng Nai', 513.0, 92.3, 160, 340, array['co_khi','hoa_chat'], 10.9700, 106.8500),
  ('KCN Tân Bình', 'HCM', 'TP. Hồ Chí Minh', 'Tân Phú, TP.HCM', 108.0, 100.0, 120, 260, array['may_mac','thuc_pham'], 10.8000, 106.6300),
  ('KCN VSIP Hải Phòng', 'HP', 'Hải Phòng', 'Thủy Nguyên, Hải Phòng', 1600.0, 78.4, 85, 190, array['dien_tu'], 20.9000, 106.6800),
  ('KCN Long Hậu', 'LA', 'Long An', 'Cần Giuộc, Long An', 244.0, 85.1, 70, 150, array['thuc_pham','hoa_chat'], 10.6100, 106.6900),
  ('KCN Sóng Thần', 'BD', 'Bình Dương', 'Dĩ An, Bình Dương', 178.0, 100.0, 200, 420, array['co_khi','may_mac'], 10.9000, 106.7700),
  ('KCN Hòa Khánh', 'DNG', 'Đà Nẵng', 'Liên Chiểu, Đà Nẵng', 396.0, 90.2, 95, 180, array['dien_tu','co_khi'], 16.0700, 108.1400)
on conflict (name) do nothing;

-- ============================================================
-- Revenue partners mẫu
-- ============================================================
insert into public.revenue_partners (partner_name, partner_type, commission_pct, is_active)
values
  ('FWD Bảo hiểm', 'insurance', 15.0, true),
  ('Prudential', 'insurance', 12.0, true),
  ('Tima', 'finance', 8.0, true),
  ('MCredit', 'finance', 10.0, true)
on conflict (partner_name) do nothing;

-- ============================================================
-- Nhà tuyển dụng mẫu — dữ liệu minh hoạ cho trang Tìm việc làm, không phải NTD
-- đã đăng ký thật qua /tuyen-dung. company_slug có unique constraint nên insert
-- này idempotent (chạy lại không nhân đôi).
-- ============================================================
insert into public.employers (company_name, company_slug, industry, province_code, contact_phone, is_verified, account_type)
values
  ('Công ty TNHH May Mặc Phong Phú', 'may-mac-phong-phu', 'may_mac', 'BD', '02743781234', true, 'featured'),
  ('Samsung Electronics Vietnam (SEHC)', 'samsung-sehc-vietnam', 'dien_tu', 'HCM', '0283715678', true, 'enterprise'),
  ('Lazada Express Vietnam', 'lazada-express-vietnam', null, 'LA', '02723789012', true, 'basic'),
  ('Tập đoàn Thép Hòa Phát - Dung Quất', 'hoa-phat-dung-quat', 'co_khi', 'QNG', '0553836789', true, 'enterprise'),
  ('LG Electronics Vietnam Hải Phòng', 'lg-electronics-vietnam', 'dien_tu', 'HP', '02253591234', true, 'featured'),
  ('VinFast Manufacturing', 'vinfast-manufacturing', 'co_khi', 'HP', '02253597890', true, 'enterprise'),
  ('Công ty CP Thực phẩm Sài Gòn Food', 'saigon-food', 'thuc_pham', 'HCM', '0283754321', true, 'basic'),
  ('Công ty TNHH Cơ khí Chính xác Việt', 'co-khi-chinh-xac-viet', 'co_khi', 'BN', '02223651234', true, 'basic'),
  ('Công ty TNHH Giày da Đông Hưng', 'giay-da-dong-hung', 'may_mac', 'DN', '02513921234', true, 'basic'),
  ('Công ty TNHH Điện tử Hanwha Techwin VN', 'hanwha-techwin-vn', 'dien_tu', 'BD', '02743841234', true, 'featured')
on conflict (company_slug) do nothing;

-- ============================================================
-- Tin tuyển dụng mẫu — 30 tin trải đều tỉnh/ngành/lương/tag để test filter thật.
-- slug có unique constraint nên insert này idempotent.
-- ============================================================
insert into public.jobs (employer_id, slug, title, description, requirements, salary_min, salary_max, job_type, province_code, district, kcn_id, industry, quantity, tier, status, is_urgent, has_housing, has_shuttle, has_meals, no_experience_required, shift_type)
values
  ((select id from public.employers where company_slug='may-mac-phong-phu'), 'cn-may-cong-nghiep-phong-phu-binh-duong', 'Công nhân May Công nghiệp', 'Tuyển 200 công nhân may công nghiệp làm việc tại xưởng may xuất khẩu, không yêu cầu kinh nghiệm, được đào tạo tay nghề miễn phí trong 2 tuần đầu.', 'Nữ ưu tiên, 18-40 tuổi, chịu được áp lực công việc theo ca', 8000000, 12000000, 'full_time', 'BD', 'Dĩ An', (select id from public.kcn where name='KCN Sóng Thần'), 'may_mac', 200, 'featured', 'approved', true, true, true, false, true, 'day'),
  ((select id from public.employers where company_slug='may-mac-phong-phu'), 'to-truong-chuyen-may-phong-phu', 'Tổ trưởng chuyền May', 'Quản lý 1 chuyền may 40-50 công nhân, đảm bảo tiến độ và chất lượng sản phẩm.', 'Có kinh nghiệm quản lý chuyền tối thiểu 1 năm, biết đọc bảng thông số kỹ thuật', 12000000, 16000000, 'full_time', 'BD', 'Dĩ An', (select id from public.kcn where name='KCN Sóng Thần'), 'may_mac', 5, 'basic', 'approved', false, false, true, false, false, 'day'),
  ((select id from public.employers where company_slug='may-mac-phong-phu'), 'cn-cat-may-ca-dem-phong-phu', 'Công nhân Cắt may (Ca đêm)', 'Làm việc ca đêm, phụ cấp ca đêm 25%, có xe đưa đón miễn phí từ các huyện lân cận.', 'Không yêu cầu kinh nghiệm', 9000000, 13000000, 'full_time', 'BD', 'Dĩ An', (select id from public.kcn where name='KCN Sóng Thần'), 'may_mac', 80, 'featured', 'approved', true, true, true, true, true, 'night'),

  ((select id from public.employers where company_slug='samsung-sehc-vietnam'), 'cn-lap-rap-dien-tu-samsung-sehc', 'Công nhân Lắp ráp Điện tử', 'Lắp ráp linh kiện điện thoại thông minh trên dây chuyền tự động hóa cao, môi trường làm việc sạch, mát.', '18-35 tuổi, mắt không cận nặng, ngoại hình khá, có thể đứng làm việc liên tục', 9000000, 14000000, 'full_time', 'HCM', 'TP. Thủ Đức', (select id from public.kcn where name='KCN Tân Bình'), 'dien_tu', 500, 'campaign', 'approved', false, false, true, true, true, 'rotating'),
  ((select id from public.employers where company_slug='samsung-sehc-vietnam'), 'kts-kiem-tra-chat-luong-samsung', 'Kỹ thuật viên Kiểm tra Chất lượng (QC)', 'Kiểm tra chất lượng sản phẩm đầu ra theo tiêu chuẩn Samsung, lập báo cáo lỗi hàng ngày.', 'Tốt nghiệp Trung cấp/Cao đẳng Điện tử trở lên, có kinh nghiệm QC là lợi thế', 10000000, 15000000, 'full_time', 'HCM', 'TP. Thủ Đức', (select id from public.kcn where name='KCN Tân Bình'), 'dien_tu', 20, 'basic', 'approved', false, false, true, true, false, 'day'),
  ((select id from public.employers where company_slug='samsung-sehc-vietnam'), 'cn-van-hanh-may-smt-samsung', 'Công nhân Vận hành Máy SMT', 'Vận hành, giám sát máy dán linh kiện SMT, xử lý lỗi cơ bản trên dây chuyền.', 'Đã qua đào tạo vận hành máy SMT hoặc tương đương', 11000000, 16000000, 'full_time', 'HCM', 'TP. Thủ Đức', (select id from public.kcn where name='KCN Tân Bình'), 'dien_tu', 30, 'featured', 'approved', true, false, true, true, false, 'rotating'),

  ((select id from public.employers where company_slug='lazada-express-vietnam'), 'nv-kho-boc-xep-lazada-long-an', 'Nhân viên Kho · Bốc xếp · Đóng gói', 'Bốc xếp, phân loại, đóng gói hàng hóa tại trung tâm phân loại hàng thương mại điện tử.', 'Sức khỏe tốt, chịu được cường độ công việc cao vào mùa cao điểm', 7000000, 10000000, 'full_time', 'LA', 'Cần Giuộc', (select id from public.kcn where name='KCN Long Hậu'), 'kho_van', 150, 'featured', 'approved', true, false, true, false, true, 'rotating'),
  ((select id from public.employers where company_slug='lazada-express-vietnam'), 'tai-xe-giao-hang-lazada-long-an', 'Tài xế Giao hàng (Xe máy)', 'Giao hàng nội thành và các huyện lân cận, thu nhập theo đơn hàng + lương cứng.', 'Có bằng lái xe máy A1, xe máy riêng, điện thoại smartphone', 8000000, 15000000, 'full_time', 'LA', 'Cần Giuộc', null, 'van_tai', 40, 'basic', 'approved', false, false, false, false, true, 'day'),
  ((select id from public.employers where company_slug='lazada-express-vietnam'), 'nv-phan-loai-hang-ca-dem-lazada', 'Nhân viên Phân loại hàng (Ca đêm)', 'Phân loại bưu kiện theo tuyến, làm việc ca đêm, phụ cấp hấp dẫn.', 'Không yêu cầu kinh nghiệm, chăm chỉ', 8500000, 11000000, 'part_time', 'LA', 'Cần Giuộc', (select id from public.kcn where name='KCN Long Hậu'), 'kho_van', 60, 'basic', 'approved', false, false, true, true, true, 'night'),

  ((select id from public.employers where company_slug='hoa-phat-dung-quat'), 'cn-van-hanh-cnc-hoa-phat-dung-quat', 'Công nhân Vận hành Máy CNC · Hàn CO2', 'Vận hành máy CNC, hàn CO2 trong dây chuyền sản xuất thép, làm việc theo ca xoay.', 'Có bằng nghề CNC hoặc chứng chỉ hàn CO2, ưu tiên có kinh nghiệm nhà máy thép', 12000000, 18000000, 'full_time', 'QNG', 'Dung Quất', null, 'co_khi', 60, 'campaign', 'approved', false, true, false, true, false, 'rotating'),
  ((select id from public.employers where company_slug='hoa-phat-dung-quat'), 'tho-han-bac-cao-hoa-phat', 'Thợ Hàn bậc cao', 'Hàn kết cấu thép chịu lực, đọc bản vẽ kỹ thuật, đảm bảo tiêu chuẩn an toàn lao động.', 'Tay nghề hàn bậc 3/7 trở lên, có kinh nghiệm tối thiểu 2 năm', 15000000, 22000000, 'full_time', 'QNG', 'Dung Quất', null, 'co_khi', 15, 'basic', 'approved', false, true, false, true, false, 'day'),
  ((select id from public.employers where company_slug='hoa-phat-dung-quat'), 'cn-boc-xep-nguyen-lieu-hoa-phat', 'Công nhân Bốc xếp Nguyên liệu', 'Bốc xếp nguyên liệu sản xuất thép, làm việc ngoài trời, có phụ cấp độc hại.', 'Sức khỏe tốt, không yêu cầu kinh nghiệm', 9000000, 13000000, 'full_time', 'QNG', 'Dung Quất', null, 'kho_van', 30, 'free', 'approved', false, true, true, true, true, 'day'),

  ((select id from public.employers where company_slug='lg-electronics-vietnam'), 'cn-lap-rap-tivi-lg-hai-phong', 'Công nhân Lắp ráp TV/Màn hình', 'Lắp ráp TV, màn hình trên dây chuyền hiện đại, môi trường làm việc trong nhà máy đạt chuẩn.', '18 tuổi trở lên, không yêu cầu kinh nghiệm, được đào tạo', 8500000, 13000000, 'full_time', 'HP', 'Tràng Duệ', (select id from public.kcn where name='KCN VSIP Hải Phòng'), 'dien_tu', 300, 'featured', 'approved', true, true, true, true, true, 'rotating'),
  ((select id from public.employers where company_slug='lg-electronics-vietnam'), 'ky-thuat-vien-bao-tri-lg', 'Kỹ thuật viên Bảo trì Thiết bị', 'Bảo trì, sửa chữa thiết bị dây chuyền sản xuất, đảm bảo máy móc vận hành liên tục.', 'Tốt nghiệp Cao đẳng/Đại học Cơ điện tử, có kinh nghiệm bảo trì nhà máy', 13000000, 19000000, 'full_time', 'HP', 'Tràng Duệ', (select id from public.kcn where name='KCN VSIP Hải Phòng'), 'co_khi', 10, 'basic', 'approved', false, true, true, true, false, 'rotating'),

  ((select id from public.employers where company_slug='vinfast-manufacturing'), 'cn-lap-rap-o-to-dien-vinfast', 'Công nhân Lắp ráp Ô tô Điện', 'Lắp ráp linh kiện xe điện trên dây chuyền tự động hóa, đào tạo bài bản trước khi vào ca chính thức.', '18-40 tuổi, sức khỏe tốt, có thể làm việc theo dây chuyền', 11000000, 16000000, 'full_time', 'HP', 'Đình Vũ', null, 'co_khi', 600, 'campaign', 'approved', true, true, true, true, true, 'rotating'),
  ((select id from public.employers where company_slug='vinfast-manufacturing'), 'ky-su-san-xuat-vinfast', 'Kỹ sư Sản xuất (Production Engineer)', 'Giám sát quy trình sản xuất, cải tiến năng suất dây chuyền lắp ráp ô tô điện.', 'Tốt nghiệp Đại học Kỹ thuật, ưu tiên ngành Ô tô/Cơ khí/Tự động hóa', 16000000, 25000000, 'full_time', 'HP', 'Đình Vũ', null, 'co_khi', 8, 'featured', 'approved', false, false, true, true, false, 'day'),
  ((select id from public.employers where company_slug='vinfast-manufacturing'), 'cn-son-hoan-thien-vinfast', 'Công nhân Sơn hoàn thiện', 'Sơn hoàn thiện thân xe theo quy trình kiểm soát chất lượng nghiêm ngặt.', 'Không dị ứng hóa chất, có sức khỏe tốt', 10000000, 15000000, 'full_time', 'HP', 'Đình Vũ', null, 'co_khi', 40, 'basic', 'approved', false, true, true, true, false, 'rotating'),

  ((select id from public.employers where company_slug='saigon-food'), 'cn-che-bien-thuc-pham-saigon-food', 'Công nhân Chế biến Thực phẩm', 'Sơ chế, chế biến thực phẩm đông lạnh xuất khẩu, làm việc trong môi trường lạnh.', 'Không mắc bệnh truyền nhiễm, có giấy khám sức khỏe', 8000000, 11000000, 'full_time', 'HCM', 'Bình Chánh', (select id from public.kcn where name='KCN Tân Bình'), 'thuc_pham', 100, 'basic', 'approved', false, false, true, true, true, 'day'),
  ((select id from public.employers where company_slug='saigon-food'), 'nv-dong-goi-thuc-pham-saigon-food', 'Nhân viên Đóng gói Thực phẩm', 'Đóng gói sản phẩm theo quy cách, kiểm tra hạn sử dụng và nhãn mác trước khi xuất kho.', 'Cẩn thận, tỉ mỉ, không yêu cầu kinh nghiệm', 7500000, 10000000, 'part_time', 'HCM', 'Bình Chánh', (select id from public.kcn where name='KCN Tân Bình'), 'thuc_pham', 50, 'free', 'approved', false, false, true, true, true, 'day'),

  ((select id from public.employers where company_slug='co-khi-chinh-xac-viet'), 'cn-gia-cong-co-khi-chinh-xac', 'Công nhân Gia công Cơ khí Chính xác', 'Vận hành máy tiện, phay CNC gia công linh kiện chính xác cho ngành điện tử.', 'Biết đọc bản vẽ kỹ thuật cơ khí, ưu tiên có chứng chỉ nghề', 10000000, 15000000, 'full_time', 'BN', 'Từ Sơn', (select id from public.kcn where name='KCN VSIP Bắc Ninh'), 'co_khi', 25, 'basic', 'approved', false, false, true, false, false, 'day'),
  ((select id from public.employers where company_slug='co-khi-chinh-xac-viet'), 'nv-kcs-co-khi-chinh-xac', 'Nhân viên KCS (Kiểm soát chất lượng)', 'Kiểm tra kích thước, dung sai sản phẩm cơ khí bằng thiết bị đo chuyên dụng.', 'Biết sử dụng thước cặp, panme, có kinh nghiệm KCS cơ khí', 9500000, 14000000, 'full_time', 'BN', 'Từ Sơn', (select id from public.kcn where name='KCN VSIP Bắc Ninh'), 'co_khi', 8, 'free', 'approved', false, false, true, false, false, 'day'),

  ((select id from public.employers where company_slug='giay-da-dong-hung'), 'cn-may-giay-dong-hung-dong-nai', 'Công nhân May Giày', 'May mũ giày thể thao xuất khẩu, đào tạo tay nghề miễn phí cho người mới.', 'Không yêu cầu kinh nghiệm, kiên nhẫn, tỉ mỉ', 8000000, 12000000, 'full_time', 'DN', 'Biên Hòa', (select id from public.kcn where name='KCN Amata Đồng Nai'), 'may_mac', 400, 'featured', 'approved', true, true, true, true, true, 'day'),
  ((select id from public.employers where company_slug='giay-da-dong-hung'), 'to-truong-san-xuat-giay-dong-hung', 'Tổ trưởng Sản xuất', 'Quản lý tổ sản xuất 30-40 người, theo dõi năng suất và chất lượng.', 'Kinh nghiệm quản lý tổ sản xuất ngành giày tối thiểu 1 năm', 11000000, 15000000, 'full_time', 'DN', 'Biên Hòa', (select id from public.kcn where name='KCN Amata Đồng Nai'), 'may_mac', 6, 'basic', 'approved', false, true, true, true, false, 'day'),
  ((select id from public.employers where company_slug='giay-da-dong-hung'), 'cn-cat-da-dong-hung', 'Công nhân Cắt da (Ca đêm)', 'Cắt da nguyên liệu theo khuôn mẫu, làm việc ca đêm có phụ cấp thêm 25%.', 'Không yêu cầu kinh nghiệm', 8500000, 12500000, 'full_time', 'DN', 'Biên Hòa', (select id from public.kcn where name='KCN Amata Đồng Nai'), 'may_mac', 60, 'basic', 'approved', false, true, true, true, true, 'night'),

  ((select id from public.employers where company_slug='hanwha-techwin-vn'), 'cn-lap-rap-camera-hanwha-binh-duong', 'Công nhân Lắp ráp Camera Giám sát', 'Lắp ráp linh kiện camera an ninh trên dây chuyền tự động, môi trường phòng sạch.', '18-35 tuổi, tay nghề khéo léo, không yêu cầu kinh nghiệm', 9000000, 13500000, 'full_time', 'BD', 'Bến Cát', null, 'dien_tu', 150, 'campaign', 'approved', true, true, true, true, true, 'rotating'),
  ((select id from public.employers where company_slug='hanwha-techwin-vn'), 'ky-thuat-vien-dien-tu-hanwha', 'Kỹ thuật viên Điện tử', 'Kiểm tra, sửa lỗi bo mạch điện tử camera trước khi xuất xưởng.', 'Tốt nghiệp Trung cấp Điện tử trở lên', 11000000, 16000000, 'full_time', 'BD', 'Bến Cát', null, 'dien_tu', 12, 'basic', 'approved', false, true, true, true, false, 'day')
on conflict (slug) do nothing;
-- Tạo tài khoản đăng nhập (users) cho các công ty đã seed trực tiếp vào employers
-- (không qua form đăng ký nên chưa có user_id). Mật khẩu chung: 123456
-- Hash: $2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2
-- Idempotent: ON CONFLICT (email) DO UPDATE set email=excluded.email chỉ để luôn
-- RETURNING được id (kể cả khi user đã tồn tại từ lần chạy trước).

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('hr@phongphu.vn', '02743781234', 'Phòng Nhân sự - Công ty TNHH May Mặc Phong Phú', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'may-mac-phong-phu';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('tuyendung@samsungsehc.vn', '0283715678', 'Phòng Nhân sự - Samsung Electronics Vietnam (SEHC)', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'samsung-sehc-vietnam';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('hr@lazada.vn', '02723789012', 'Phòng Nhân sự - Lazada Express Vietnam', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'lazada-express-vietnam';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('tuyendung@hoaphat.vn', '0553836789', 'Phòng Nhân sự - Tập đoàn Thép Hòa Phát - Dung Quất', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'hoa-phat-dung-quat';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('hr@lgevn.vn', '02253591234', 'Phòng Nhân sự - LG Electronics Vietnam Hải Phòng', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'lg-electronics-vietnam';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('tuyendung@vinfast.vn', '02253597890', 'Phòng Nhân sự - VinFast Manufacturing', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'vinfast-manufacturing';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('hr@saigonfood.vn', '0283754321', 'Phòng Nhân sự - Công ty CP Thực phẩm Sài Gòn Food', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'saigon-food';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('tuyendung@cokhichinhxacviet.vn', '02223651234', 'Phòng Nhân sự - Công ty TNHH Cơ khí Chính xác Việt', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'co-khi-chinh-xac-viet';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('hr@donghung.vn', '02513921234', 'Phòng Nhân sự - Công ty TNHH Giày da Đông Hưng', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'giay-da-dong-hung';

with u as (
  insert into public.users (email, phone, full_name, password_hash, role)
  values ('hr@hanwhatechwin.vn', '02743841234', 'Phòng Nhân sự - Công ty TNHH Điện tử Hanwha Techwin VN', '$2a$10$KsN9lzkZi632MLI/0D.FcO.GD/hZiDY4lKlCJyFxVHzJkNx4w5mO2', 'employer')
  on conflict (email) do update set email = excluded.email
  returning id
)
update public.employers set user_id = (select id from u) where company_slug = 'hanwha-techwin-vn';

-- ============================================================
-- Ứng viên mẫu (form nhanh) — 50 dòng, chia đều 7 ngành trong JOB_INDUSTRIES
-- (apps/web/src/lib/industries.ts) để test filter/Blast SMS-Zalo theo ngành + tỉnh
-- có đủ dữ liệu thật. phone có unique constraint (migration 20260820120001) nên
-- insert này idempotent.
-- ============================================================
insert into public.candidates (full_name, phone, zalo, province, desired_industry, desired_salary_min, experience_years, status, source, created_at)
values
  ('Nguyễn Văn An', '0900000001', '0900000001', 'HN', 'may_mac', 7000000, 0, 'new', 'quick_form', now() - interval '5 minutes'),
  ('Trần Thị Bích', '0900000002', '0900000002', 'HYN', 'may_mac', 8000000, 1, 'new', 'quick_form', now() - interval '46 minutes'),
  ('Lê Văn Cường', '0900000003', '0900000003', 'DNA', 'may_mac', 9000000, 2, 'new', 'quick_form', now() - interval '87 minutes'),
  ('Phạm Thị Diễm', '0900000004', '0900000004', 'QNI', 'may_mac', 10000000, 3, 'new', 'quick_form', now() - interval '128 minutes'),
  ('Hoàng Văn Đức', '0900000005', '0900000005', 'BNI', 'may_mac', 11000000, 4, 'new', 'quick_form', now() - interval '169 minutes'),
  ('Huỳnh Thị Hoa', '0900000006', '0900000006', 'QNG', 'may_mac', 12000000, 5, 'new', 'quick_form', now() - interval '210 minutes'),
  ('Phan Văn Hùng', '0900000007', '0900000007', 'HCM', 'may_mac', 13000000, 0, 'new', 'quick_form', now() - interval '251 minutes'),
  ('Vũ Thị Lan', '0900000008', '0900000008', 'HP', 'may_mac', 14000000, 1, 'new', 'quick_form', now() - interval '292 minutes'),
  ('Võ Văn Long', '0900000009', '0900000009', 'QNG', 'dien_tu', 15000000, 2, 'new', 'quick_form', now() - interval '333 minutes'),
  ('Đặng Thị Mai', '0900000010', '0900000010', 'HCM', 'dien_tu', 7000000, 3, 'new', 'quick_form', now() - interval '374 minutes'),
  ('Bùi Văn Nam', '0900000011', '0900000011', 'HP', 'dien_tu', 8000000, 4, 'new', 'quick_form', now() - interval '415 minutes'),
  ('Đỗ Thị Nhung', '0900000012', '0900000012', 'DNG', 'dien_tu', 9000000, 5, 'new', 'quick_form', now() - interval '456 minutes'),
  ('Ngô Văn Quang', '0900000013', '0900000013', 'TNI', 'dien_tu', 10000000, 0, 'new', 'quick_form', now() - interval '497 minutes'),
  ('Dương Thị Thảo', '0900000014', '0900000014', 'HN', 'dien_tu', 11000000, 1, 'new', 'quick_form', now() - interval '538 minutes'),
  ('Lý Văn Thắng', '0900000015', '0900000015', 'HYN', 'dien_tu', 12000000, 2, 'new', 'quick_form', now() - interval '579 minutes'),
  ('Nguyễn Thị Tuyết', '0900000016', '0900000016', 'TNI', 'kho_van', 13000000, 3, 'new', 'quick_form', now() - interval '620 minutes'),
  ('Trần Văn Vinh', '0900000017', '0900000017', 'HN', 'kho_van', 14000000, 4, 'new', 'quick_form', now() - interval '661 minutes'),
  ('Lê Thị Yến', '0900000018', '0900000018', 'HYN', 'kho_van', 15000000, 5, 'new', 'quick_form', now() - interval '702 minutes'),
  ('Phạm Văn An', '0900000019', '0900000019', 'DNA', 'kho_van', 7000000, 0, 'new', 'quick_form', now() - interval '743 minutes'),
  ('Hoàng Thị Bích', '0900000020', '0900000020', 'QNI', 'kho_van', 8000000, 1, 'new', 'quick_form', now() - interval '784 minutes'),
  ('Huỳnh Văn Cường', '0900000021', '0900000021', 'BNI', 'kho_van', 9000000, 2, 'new', 'quick_form', now() - interval '825 minutes'),
  ('Phan Thị Diễm', '0900000022', '0900000022', 'QNG', 'kho_van', 10000000, 3, 'new', 'quick_form', now() - interval '866 minutes'),
  ('Vũ Văn Đức', '0900000023', '0900000023', 'QNI', 'co_khi', 11000000, 4, 'new', 'quick_form', now() - interval '907 minutes'),
  ('Võ Thị Hoa', '0900000024', '0900000024', 'BNI', 'co_khi', 12000000, 5, 'new', 'quick_form', now() - interval '948 minutes'),
  ('Đặng Văn Hùng', '0900000025', '0900000025', 'QNG', 'co_khi', 13000000, 0, 'new', 'quick_form', now() - interval '989 minutes'),
  ('Bùi Thị Lan', '0900000026', '0900000026', 'HCM', 'co_khi', 14000000, 1, 'new', 'quick_form', now() - interval '1030 minutes'),
  ('Đỗ Văn Long', '0900000027', '0900000027', 'HP', 'co_khi', 15000000, 2, 'new', 'quick_form', now() - interval '1071 minutes'),
  ('Ngô Thị Mai', '0900000028', '0900000028', 'DNG', 'co_khi', 7000000, 3, 'new', 'quick_form', now() - interval '1112 minutes'),
  ('Dương Văn Nam', '0900000029', '0900000029', 'TNI', 'co_khi', 8000000, 4, 'new', 'quick_form', now() - interval '1153 minutes'),
  ('Lý Thị Nhung', '0900000030', '0900000030', 'HP', 'thuc_pham', 9000000, 5, 'new', 'quick_form', now() - interval '1194 minutes'),
  ('Nguyễn Văn Quang', '0900000031', '0900000031', 'DNG', 'thuc_pham', 10000000, 0, 'new', 'quick_form', now() - interval '1235 minutes'),
  ('Trần Thị Thảo', '0900000032', '0900000032', 'TNI', 'thuc_pham', 11000000, 1, 'new', 'quick_form', now() - interval '1276 minutes'),
  ('Lê Văn Thắng', '0900000033', '0900000033', 'HN', 'thuc_pham', 12000000, 2, 'new', 'quick_form', now() - interval '1317 minutes'),
  ('Phạm Thị Tuyết', '0900000034', '0900000034', 'HYN', 'thuc_pham', 13000000, 3, 'new', 'quick_form', now() - interval '1358 minutes'),
  ('Hoàng Văn Vinh', '0900000035', '0900000035', 'DNA', 'thuc_pham', 14000000, 4, 'new', 'quick_form', now() - interval '1399 minutes'),
  ('Huỳnh Thị Yến', '0900000036', '0900000036', 'QNI', 'thuc_pham', 15000000, 5, 'new', 'quick_form', now() - interval '1440 minutes'),
  ('Phan Văn An', '0900000037', '0900000037', 'HYN', 'xay_dung', 7000000, 0, 'new', 'quick_form', now() - interval '1481 minutes'),
  ('Vũ Thị Bích', '0900000038', '0900000038', 'DNA', 'xay_dung', 8000000, 1, 'new', 'quick_form', now() - interval '1522 minutes'),
  ('Võ Văn Cường', '0900000039', '0900000039', 'QNI', 'xay_dung', 9000000, 2, 'new', 'quick_form', now() - interval '1563 minutes'),
  ('Đặng Thị Diễm', '0900000040', '0900000040', 'BNI', 'xay_dung', 10000000, 3, 'new', 'quick_form', now() - interval '1604 minutes'),
  ('Bùi Văn Đức', '0900000041', '0900000041', 'QNG', 'xay_dung', 11000000, 4, 'new', 'quick_form', now() - interval '1645 minutes'),
  ('Đỗ Thị Hoa', '0900000042', '0900000042', 'HCM', 'xay_dung', 12000000, 5, 'new', 'quick_form', now() - interval '1686 minutes'),
  ('Ngô Văn Hùng', '0900000043', '0900000043', 'HP', 'xay_dung', 13000000, 0, 'new', 'quick_form', now() - interval '1727 minutes'),
  ('Dương Thị Lan', '0900000044', '0900000044', 'QNG', 'van_tai', 14000000, 1, 'new', 'quick_form', now() - interval '1768 minutes'),
  ('Lý Văn Long', '0900000045', '0900000045', 'HCM', 'van_tai', 15000000, 2, 'new', 'quick_form', now() - interval '1809 minutes'),
  ('Nguyễn Thị Mai', '0900000046', '0900000046', 'HP', 'van_tai', 7000000, 3, 'new', 'quick_form', now() - interval '1850 minutes'),
  ('Trần Văn Nam', '0900000047', '0900000047', 'DNG', 'van_tai', 8000000, 4, 'new', 'quick_form', now() - interval '1891 minutes'),
  ('Lê Thị Nhung', '0900000048', '0900000048', 'TNI', 'van_tai', 9000000, 5, 'new', 'quick_form', now() - interval '1932 minutes'),
  ('Phạm Văn Quang', '0900000049', '0900000049', 'HN', 'van_tai', 10000000, 0, 'new', 'quick_form', now() - interval '1973 minutes'),
  ('Hoàng Thị Thảo', '0900000050', '0900000050', 'HYN', 'van_tai', 11000000, 1, 'new', 'quick_form', now() - interval '2014 minutes')
on conflict (phone) do nothing;
