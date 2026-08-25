-- Trang Chiến dịch riêng cho tin tuyển dụng tier='campaign' (1.5tr/tin, 60 ngày,
-- mua thêm độc lập với gói thuê bao tài khoản — xem JOB_ADDONS ở packages.ts).
-- Chiến dịch dùng LẠI chính bảng jobs (không tách bảng riêng) vì các số liệu cần
-- hiển thị (số lượng tuyển, đã nộp, còn bao nhiêu ngày) đã có sẵn ở quantity,
-- apply_count, expires_at — chỉ thiếu phần trình bày (banner theme + đoạn giới
-- thiệu riêng) mà NTD tự chỉnh sau khi mua.
alter table public.jobs add column if not exists campaign_theme text not null default 'orange'
  constraint jobs_campaign_theme_check check (campaign_theme in ('orange', 'blue', 'green', 'purple', 'pink'));
alter table public.jobs add column if not exists campaign_story text;

comment on column public.jobs.campaign_theme is 'Chỉ có ý nghĩa khi tier=campaign — theme màu banner trang chiến dịch, NTD tự chọn.';
comment on column public.jobs.campaign_story is 'Chỉ có ý nghĩa khi tier=campaign — đoạn "Về chiến dịch này" NTD tự viết, khác mô tả công việc chuẩn.';
