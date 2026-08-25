-- Thêm unique constraint theo khóa tự nhiên để seed.sql idempotent thật sự
-- (trước đó insert lại sẽ nhân đôi dữ liệu — đã xảy ra thực tế khi seed 2 lần).
alter table public.kcn
  add constraint kcn_name_unique unique (name);

alter table public.revenue_partners
  add constraint revenue_partners_partner_name_unique unique (partner_name);
