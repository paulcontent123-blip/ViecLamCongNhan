-- Thêm unique constraint trên candidates.phone để seed.sql idempotent thật sự
-- (cùng lý do đã áp dụng cho kcn.name / revenue_partners.partner_name ở migration
-- 20260817130002 — trước đó insert lại sẽ nhân đôi dữ liệu ứng viên mẫu).
alter table public.candidates
  add constraint candidates_phone_unique unique (phone);
