-- Yêu cầu xóa tài khoản của người lao động: công nhân gửi yêu cầu, Admin xác nhận thì mới xóa.
-- Chỉ THÊM bảng mới; không đổi bảng hay hàm nào đang có. Việc xóa thật vẫn dùng hàm có sẵn delete_candidate_account.
create table if not exists public.candidate_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason text check (reason is null or char_length(reason) <= 500),
  requested_at timestamptz not null default now(),
  handled_by uuid references public.users(id) on delete set null,
  handled_at timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 500)
);

-- Mỗi tài khoản chỉ có một yêu cầu đang chờ; gửi lại khi đang chờ không tạo bản trùng.
create unique index if not exists candidate_deletion_requests_one_pending_idx
  on public.candidate_deletion_requests (user_id) where status = 'pending';

create index if not exists candidate_deletion_requests_status_idx
  on public.candidate_deletion_requests (status, requested_at desc);

create index if not exists candidate_deletion_requests_user_idx
  on public.candidate_deletion_requests (user_id, requested_at desc);

-- Chỉ service_role (route phía máy chủ) đọc và ghi; người dùng không truy cập bảng trực tiếp.
alter table public.candidate_deletion_requests enable row level security;
revoke all on public.candidate_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on public.candidate_deletion_requests to service_role;

comment on table public.candidate_deletion_requests is
  'Yêu cầu xóa tài khoản của người lao động. Admin xác nhận (approved) thì tài khoản mới bị xóa qua delete_candidate_account.';
