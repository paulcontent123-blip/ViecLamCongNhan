-- Báo lỗi ứng dụng: công nhân, nhà tuyển dụng và 5 loại đối tác gửi tiêu đề và mô tả lỗi; Admin xem và xử lý trên app Admin.
-- Chạy TRƯỚC khi deploy web: các route /api/mobile/bug-reports và /api/mobile/admin/bug-reports đọc và ghi bảng này.
--   reporter_user_id : người gửi (lấy từ phiên đăng nhập, không nhận từ client); đặt null khi tài khoản bị xóa hẳn, báo lỗi vẫn giữ.
--   app_version, platform : app tự gửi kèm để Admin tái hiện lỗi; không phải người dùng nhập.
--   status : new (mới), in_progress (đang xử lý), resolved (đã xử lý), closed (đóng, không xử lý).
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.users(id) on delete set null,
  reporter_role text not null
    constraint bug_reports_reporter_role_check check (reporter_role in (
      'candidate', 'employer', 'training_provider', 'rental_provider', 'insurance_provider', 'finance_provider', 'health_provider'
    )),
  title text not null
    constraint bug_reports_title_check check (char_length(btrim(title)) between 3 and 100),
  description text not null
    constraint bug_reports_description_check check (char_length(btrim(description)) between 10 and 2000),
  app_version text
    constraint bug_reports_app_version_check check (app_version is null or char_length(app_version) <= 30),
  platform text
    constraint bug_reports_platform_check check (platform is null or platform in ('android', 'ios', 'web')),
  status text not null default 'new'
    constraint bug_reports_status_check check (status in ('new', 'in_progress', 'resolved', 'closed')),
  admin_note text
    constraint bug_reports_admin_note_check check (admin_note is null or char_length(admin_note) <= 1000),
  handled_by uuid references public.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bug_reports_status_created_idx on public.bug_reports (status, created_at desc);
create index if not exists bug_reports_reporter_created_idx on public.bug_reports (reporter_user_id, created_at desc);

-- Chỉ service_role (route phía server) đọc và ghi; người dùng không truy cập bảng trực tiếp.
alter table public.bug_reports enable row level security;
revoke all on public.bug_reports from public, anon, authenticated;
grant select, insert, update on public.bug_reports to service_role;
