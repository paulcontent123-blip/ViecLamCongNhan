-- Kích hoạt gói Chiến dịch (nâng tier + auto-blast Zalo) giờ chỉ chạy SAU KHI Admin
-- xác nhận đã nhận thanh toán đơn hàng (orders.status='paid'), thay vì chạy ngay lúc
-- NTD tự khai đã thanh toán — orders cần biết đơn này gắn với tin nào và nội dung
-- tin nhắn Zalo NTD đã nhập lúc mua, để activateCampaignFromOrder ở employer.ts dùng
-- lại khi Admin xác nhận (xem updateOrderStatus ở admin.ts).
alter table public.orders add column if not exists job_id uuid references public.jobs (id) on delete set null;
alter table public.orders add column if not exists campaign_message text;

comment on column public.orders.job_id is 'Chỉ có ý nghĩa với order_type=job_post (mua gói Chiến dịch) — tin sẽ được nâng tier khi đơn được Admin xác nhận đã thanh toán.';
comment on column public.orders.campaign_message is 'Chỉ có ý nghĩa với order_type=job_post (mua gói Chiến dịch) — nội dung tin Zalo NTD nhập lúc mua, dùng khi auto-blast chạy lúc Admin xác nhận thanh toán.';
