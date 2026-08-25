-- Migration 20260817130003 chỉ cho đọc công khai employers.is_verified = true.
-- Nhưng NTD tự đăng ký (POST /api/employers) mặc định is_verified = false và
-- chưa có trang Admin xác minh pháp nhân được xây — nghĩa là mọi tin NTD tự đăng
-- sẽ vĩnh viễn hiện "Nhà tuyển dụng ẩn danh" trên job card công khai. "Verified"
-- nên là một badge tin cậy hiển thị thêm, không phải điều kiện để company_name
-- có hiển thị hay không. Bỏ điều kiện is_verified, giữ nguyên giới hạn cột.
drop policy if exists "employers_public_read_verified" on public.employers;

create policy "employers_public_read" on public.employers
  for select
  to anon, authenticated
  using (true);
