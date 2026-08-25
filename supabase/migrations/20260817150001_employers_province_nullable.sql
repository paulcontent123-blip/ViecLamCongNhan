-- Form đăng ký NTD gốc (login modal, bản HTML demo) chỉ hỏi Tên công ty + SĐT +
-- Email + Mật khẩu — không hỏi tỉnh/thành. Mỗi TIN ĐĂNG đã có province_code riêng
-- (bảng jobs), nên employers.province_code không bắt buộc phải biết ngay lúc đăng
-- ký nữa — cho phép null, cập nhật sau trong hồ sơ.
alter table public.employers
  alter column province_code drop not null;
