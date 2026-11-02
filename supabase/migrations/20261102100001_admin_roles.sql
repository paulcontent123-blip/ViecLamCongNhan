-- Phân quyền Admin (Ưu tiên 3): hai cấp editor và superadmin, kèm nhật ký thao tác nhạy cảm.
-- Chạy migration này TRƯỚC khi deploy web bản mới. Mọi Admin đang có trở thành superadmin để không ai bị mất quyền;
-- sau đó superadmin hạ quyền từng người xuống editor ở trang Admin → Người dùng.

alter table public.users add column if not exists admin_role text;

update public.users set admin_role = 'superadmin' where role = 'admin' and admin_role is null;

-- Chỉ tài khoản Admin có cấp quyền; tài khoản khác phải để trống.
alter table public.users drop constraint if exists users_admin_role_check;
alter table public.users add constraint users_admin_role_check check (
  (role = 'admin' and admin_role in ('editor', 'superadmin'))
  or (role <> 'admin' and admin_role is null)
);

comment on column public.users.admin_role is
  'Cấp quyền Admin: editor (biên tập nội dung) hoặc superadmin (thanh toán, đối tác, quản lý Admin, quà tiền mặt). Null với tài khoản không phải Admin.';

-- Nhật ký thao tác nhạy cảm của Admin. Chỉ thêm, không sửa hoặc xóa.
-- admin_id không khóa ngoại và có kèm email để nhật ký còn đọc được kể cả khi tài khoản bị đánh dấu đã xóa.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  admin_email text,
  admin_role text,
  action text not null check (char_length(action) between 1 and 80),
  target_type text check (target_type is null or char_length(target_type) <= 60),
  target_id text check (target_id is null or char_length(target_id) <= 120),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_admin_created_idx on public.admin_audit_log (admin_id, created_at desc);
create index if not exists admin_audit_log_action_created_idx on public.admin_audit_log (action, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select, insert on public.admin_audit_log to service_role;

create or replace function public.prevent_admin_audit_log_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception using errcode = '55000', message = 'ADMIN_AUDIT_LOG_IMMUTABLE';
end;
$$;

drop trigger if exists admin_audit_log_immutable on public.admin_audit_log;
create trigger admin_audit_log_immutable
  before update or delete on public.admin_audit_log
  for each row execute function public.prevent_admin_audit_log_mutation();

revoke all on function public.prevent_admin_audit_log_mutation() from public, anon, authenticated;
