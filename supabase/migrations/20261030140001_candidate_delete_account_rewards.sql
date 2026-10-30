-- Xóa tài khoản công nhân có xét điểm thưởng và yêu cầu đổi quà.
-- 1) Còn yêu cầu đổi quà đang chờ hoặc đã duyệt (chưa trao) thì chặn xóa, để quà tiền mặt/hiện vật không mất người nhận.
-- 2) Xóa xong, xóa trắng delivery_info (tài khoản ngân hàng, địa chỉ, số điện thoại nhận quà) ở các yêu cầu còn lại;
--    giữ số điểm, mã giao dịch và trạng thái để đối soát.
create or replace function public.delete_candidate_account(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.users%rowtype;
begin
  -- Cùng khóa với request_candidate_reward_redemption để không có yêu cầu mới chen vào giữa lúc kiểm tra và xóa.
  perform pg_advisory_xact_lock(hashtextextended('candidate-reward:' || p_user_id::text, 0));
  select * into v_user from public.users where id = p_user_id for update;
  if not found or v_user.role <> 'candidate' then return false; end if;

  if exists (
    select 1 from public.candidate_reward_redemptions
    where user_id = p_user_id and status in ('pending', 'approved')
  ) then
    raise exception using errcode = 'P0001', message = 'CANDIDATE_HAS_OPEN_REDEMPTIONS';
  end if;

  update public.jobs j set apply_count = greatest(0, j.apply_count - counts.application_count)
    from (
      select a.job_id, count(*)::integer as application_count
      from public.applications a
      join public.candidates c on c.id = a.candidate_id
      where c.user_id = p_user_id and a.job_id is not null
      group by a.job_id
    ) counts
    where j.id = counts.job_id;

  delete from public.candidates where user_id = p_user_id;
  update public.candidate_reward_redemptions set delivery_info = null
    where user_id = p_user_id and delivery_info is not null;
  update public.users set status = 'deleted', is_verified = false where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.delete_candidate_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_candidate_account(uuid) to service_role;
