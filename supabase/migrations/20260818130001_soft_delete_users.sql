-- Soft delete tài khoản: giữ bản ghi để bảo toàn lịch sử, nhưng không cho đăng nhập.
alter table public.users
  add column if not exists status text not null default 'active';

alter table public.users drop constraint if exists users_status_check;
alter table public.users
  add constraint users_status_check check (status in ('active', 'deleted'));

create index if not exists users_status_idx on public.users (status);

-- Email không phân biệt hoa thường và vẫn bị giữ lại sau soft delete, nên không
-- thể đăng ký tài khoản mới bằng email của tài khoản đã xóa.
create unique index if not exists users_email_lower_unique
  on public.users (lower(email))
  where email is not null;

comment on column public.users.status is
  'Trạng thái tài khoản: active | deleted. deleted là soft delete, không được đăng nhập.';
