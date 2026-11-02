-- Quản lý tài khoản, Đợt 3: đặt lại mật khẩu, xóa tài khoản và thu hồi phiên đăng nhập.
-- Chạy SAU 20261102100001 (admin_role) và 20261102110001 (admin_mutate_user).
--   * users.password_changed_at: mốc đổi mật khẩu; phiên đăng nhập cấp trước mốc này bị từ chối (xem lib/session-revocation.ts).
--   * admin_mutate_user thêm hành động reset_password và xử lý delete theo vai trò:
--       - công nhân: dọn dữ liệu đầy đủ bằng delete_candidate_account (chặn khi còn yêu cầu đổi quà đang xử lý);
--       - vai trò khác: đánh dấu đã xóa, xóa mật khẩu.
alter table public.users add column if not exists password_changed_at timestamptz;

comment on column public.users.password_changed_at is
  'Thời điểm mật khẩu bị đổi hoặc đặt lại. Phiên đăng nhập (JWT) có iat trước mốc này không còn hiệu lực.';

create or replace function public.admin_mutate_user(
  p_actor uuid, p_action text, p_target uuid, p_changes jsonb, p_expected jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  actor public.users%rowtype;
  target public.users%rowtype;
  next_role text;
  next_admin_role text;
  saved public.users%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('admin-account-mutations', 0));
  select * into actor from public.users where id = p_actor;
  if not found or actor.role <> 'admin' or actor.status <> 'active' or actor.admin_role is distinct from 'superadmin' then
    raise exception using errcode = 'P0001', message = 'ADMIN_FORBIDDEN';
  end if;
  if p_action = 'create' then
    if p_changes->>'role' not in ('admin', 'employer', 'agency', 'candidate') then
      raise exception using errcode = 'P0001', message = 'INVALID_ROLE';
    end if;
    insert into public.users(full_name,email,phone,role,admin_role,password_hash,status)
      values (p_changes->>'full_name', p_changes->>'email', p_changes->>'phone', p_changes->>'role',
        case when p_changes->>'role' = 'admin' then coalesce(p_changes->>'admin_role','editor') else null end,
        p_changes->>'password_hash', 'active') returning * into saved;
  elsif p_action in ('update', 'delete', 'reset_password') then
    select * into target from public.users where id = p_target for update;
    if not found then raise exception using errcode = 'P0001', message = 'ACCOUNT_NOT_FOUND'; end if;
    if target.status <> 'active' then raise exception using errcode = 'P0001', message = 'ACCOUNT_INACTIVE'; end if;
    if p_expected is not null and jsonb_build_object('full_name',target.full_name,'email',target.email,'phone',target.phone,'role',target.role,'admin_role',target.admin_role,'status',target.status) <> p_expected then
      raise exception using errcode = 'P0001', message = 'ACCOUNT_CHANGED';
    end if;
    if p_action = 'reset_password' then
      -- Mật khẩu của chính mình đổi ở nơi khác (cần cấp lại phiên); ở đây chỉ đặt lại cho tài khoản khác.
      if p_actor = p_target then raise exception using errcode = 'P0001', message = 'SELF_PROTECTED'; end if;
      if coalesce(p_changes->>'password_hash', '') = '' then raise exception using errcode = 'P0001', message = 'INVALID_ACTION'; end if;
      update public.users set password_hash = p_changes->>'password_hash', password_changed_at = now()
        where id = p_target returning * into saved;
    else
      next_role := coalesce(p_changes->>'role',target.role);
      next_admin_role := case when next_role = 'admin' then coalesce(p_changes->>'admin_role',target.admin_role,'editor') else null end;
      if p_actor = p_target and (p_action = 'delete' or next_role <> 'admin' or next_admin_role is distinct from actor.admin_role) then
        raise exception using errcode = 'P0001', message = 'SELF_PROTECTED';
      end if;
      if target.role = 'admin' and target.admin_role = 'superadmin' and (p_action = 'delete' or next_role <> 'admin' or next_admin_role <> 'superadmin') and
         not exists (select 1 from public.users where id <> p_target and role = 'admin' and admin_role = 'superadmin' and status = 'active') then
        raise exception using errcode = 'P0001', message = 'LAST_SUPERADMIN';
      end if;
      if p_action = 'update' and next_role <> target.role and (
        exists(select 1 from public.employers where user_id = p_target) or
        exists(select 1 from public.training_providers where user_id = p_target) or
        exists(select 1 from public.rental_providers where user_id = p_target) or
        exists(select 1 from public.insurance_providers where user_id = p_target) or
        exists(select 1 from public.finance_providers where user_id = p_target) or
        exists(select 1 from public.health_providers where user_id = p_target)
      ) then raise exception using errcode = 'P0001', message = 'LINKED_PARTNER_ROLE'; end if;
      if p_action = 'delete' then
        if target.role = 'candidate' then
          -- Dọn dữ liệu công nhân đầy đủ như khi công nhân tự xóa; ném CANDIDATE_HAS_OPEN_REDEMPTIONS nếu còn yêu cầu đổi quà.
          if not public.delete_candidate_account(p_target) then
            raise exception using errcode = 'P0001', message = 'ACCOUNT_INACTIVE';
          end if;
          select * into saved from public.users where id = p_target;
        else
          update public.users set status = 'deleted', password_hash = null, password_changed_at = now()
            where id = p_target returning * into saved;
        end if;
      else
        update public.users set full_name = p_changes->>'full_name', email = p_changes->>'email', phone = p_changes->>'phone',
          role = next_role, admin_role = next_admin_role,
          password_hash = coalesce(p_changes->>'password_hash',target.password_hash),
          password_changed_at = case when p_changes->>'password_hash' is not null then now() else target.password_changed_at end
          where id = p_target returning * into saved;
      end if;
    end if;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_ACTION';
  end if;
  return jsonb_build_object('id',saved.id,'full_name',saved.full_name,'email',saved.email,'phone',saved.phone,'role',saved.role,'admin_role',saved.admin_role,'status',saved.status,'is_verified',saved.is_verified,'created_at',saved.created_at);
end;
$$;
revoke all on function public.admin_mutate_user(uuid,text,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.admin_mutate_user(uuid,text,uuid,jsonb,jsonb) to service_role;
