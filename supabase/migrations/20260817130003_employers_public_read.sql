-- Job card công khai cần hiển thị tên/logo công ty (join jobs -> employers), nhưng
-- migration RLS ban đầu chặn hoàn toàn anon đọc employers -> company_name sẽ luôn
-- null trên mọi job card. Sửa: cho đọc CÔNG KHAI nhưng CHỈ những cột không nhạy
-- cảm (không lộ contact_phone/tax_code/user_id), và chỉ với NTD đã xác minh.
create policy "employers_public_read_verified" on public.employers
  for select
  to anon, authenticated
  using (is_verified = true);

revoke select on public.employers from anon, authenticated;
grant select (id, company_name, company_slug, company_logo_url, industry, province_code, account_type, is_verified, created_at)
  on public.employers to anon, authenticated;
