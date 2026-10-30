-- Cài đặt chung của quà đổi điểm (một dòng duy nhất), sửa được bất cứ lúc nào.
-- Giai đoạn này: ngưỡng cảnh báo và giới hạn quà tiền mặt mỗi người mỗi tháng (tính theo giờ Việt Nam).
-- Để trống = tắt. Admin chịu trách nhiệm xử lý quà tiền mặt (duyệt, chuyển khoản, đối soát).

create table if not exists public.candidate_reward_settings (
  id boolean primary key default true check (id),
  cash_monthly_alert_vnd integer check (cash_monthly_alert_vnd is null or cash_monthly_alert_vnd >= 1),
  cash_monthly_cap_vnd integer check (cash_monthly_cap_vnd is null or cash_monthly_cap_vnd >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  check (cash_monthly_alert_vnd is null or cash_monthly_cap_vnd is null or cash_monthly_alert_vnd <= cash_monthly_cap_vnd)
);
insert into public.candidate_reward_settings(id) values (true) on conflict (id) do nothing;

alter table public.candidate_reward_settings enable row level security;
revoke all on public.candidate_reward_settings from public, anon, authenticated;
grant all on public.candidate_reward_settings to service_role;

-- Tạo yêu cầu đổi quà: thêm kiểm tra giới hạn tiền mặt theo tháng.
drop function if exists public.request_candidate_reward_redemption(uuid, uuid, text, jsonb);

create or replace function public.request_candidate_reward_redemption(
  p_user_id uuid,
  p_reward_id uuid,
  p_idempotency_key text,
  p_delivery_info jsonb default null
) returns public.candidate_reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare
  v_existing public.candidate_reward_redemptions%rowtype;
  v_reward public.candidate_reward_catalog%rowtype;
  v_redemption public.candidate_reward_redemptions%rowtype;
  v_balance bigint;
  v_delivery jsonb;
  v_cap integer;
  v_month_total bigint;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_USER_INVALID';
  end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) not between 8 and 100 then
    raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_IDEMPOTENCY_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('candidate-reward:' || p_user_id::text, 0));
  select * into v_existing from public.candidate_reward_redemptions
    where user_id = p_user_id and idempotency_key = trim(p_idempotency_key);
  if found then return v_existing; end if;

  if not exists (select 1 from public.users u where u.id = p_user_id and u.role = 'candidate' and u.status = 'active') then
    raise exception using errcode = '42501', message = 'CANDIDATE_REWARD_USER_INVALID';
  end if;
  select * into v_reward from public.candidate_reward_catalog where id = p_reward_id and is_active = true for update;
  if not found or (v_reward.stock_remaining is not null and v_reward.stock_remaining <= 0) then
    raise exception using errcode = 'P0001', message = 'CANDIDATE_REWARD_UNAVAILABLE';
  end if;

  -- Thông tin nhận quà theo loại; chỉ giữ các khóa được phép để không lưu dữ liệu thừa.
  if p_delivery_info is not null and jsonb_typeof(p_delivery_info) <> 'object' then
    raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_DELIVERY_INVALID';
  end if;
  if v_reward.reward_type = 'cash' then
    if coalesce(char_length(trim(p_delivery_info->>'bankName')), 0) not between 2 and 100
       or coalesce(char_length(trim(p_delivery_info->>'accountNumber')), 0) not between 6 and 30
       or coalesce(char_length(trim(p_delivery_info->>'accountHolder')), 0) not between 2 and 100 then
      raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_DELIVERY_INVALID';
    end if;
    v_delivery := jsonb_build_object(
      'bankName', trim(p_delivery_info->>'bankName'),
      'accountNumber', trim(p_delivery_info->>'accountNumber'),
      'accountHolder', trim(p_delivery_info->>'accountHolder'));
  elsif v_reward.reward_type = 'physical' then
    if coalesce(char_length(trim(p_delivery_info->>'receiverName')), 0) not between 2 and 100
       or coalesce(char_length(trim(p_delivery_info->>'receiverPhone')), 0) not between 8 and 20
       or (not v_reward.is_service and coalesce(char_length(trim(p_delivery_info->>'address')), 0) not between 5 and 300)
       or coalesce(char_length(p_delivery_info->>'note'), 0) > 300 then
      raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_DELIVERY_INVALID';
    end if;
    v_delivery := jsonb_strip_nulls(jsonb_build_object(
      'receiverName', trim(p_delivery_info->>'receiverName'),
      'receiverPhone', trim(p_delivery_info->>'receiverPhone'),
      'address', nullif(trim(p_delivery_info->>'address'), ''),
      'note', nullif(trim(p_delivery_info->>'note'), '')));
  else
    v_delivery := null; -- thẻ quà: mã được Admin giao lại trong app, không cần thông tin nhận.
  end if;

  -- Giới hạn tiền mặt mỗi người mỗi tháng (giờ Việt Nam); tắt khi cash_monthly_cap_vnd trống.
  if v_reward.reward_type = 'cash' then
    select s.cash_monthly_cap_vnd into v_cap from public.candidate_reward_settings s where s.id = true;
    if v_cap is not null then
      select coalesce(sum(r.reward_value_vnd_snapshot), 0) into v_month_total
        from public.candidate_reward_redemptions r
        where r.user_id = p_user_id and r.reward_type_snapshot = 'cash'
          and r.status in ('pending', 'approved', 'fulfilled')
          and r.created_at >= (date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh');
      if v_month_total + coalesce(v_reward.value_vnd, 0) > v_cap then
        raise exception using errcode = 'P0001', message = 'CANDIDATE_REWARD_CASH_CAP_EXCEEDED';
      end if;
    end if;
  end if;

  select coalesce(sum(points_delta), 0) into v_balance from public.candidate_reward_ledger where user_id = p_user_id;
  if v_balance < v_reward.points_cost then
    raise exception using errcode = 'P0001', message = 'CANDIDATE_REWARD_INSUFFICIENT_POINTS';
  end if;

  insert into public.candidate_reward_redemptions(
    user_id, reward_id, reward_title_snapshot, points_cost, idempotency_key,
    reward_type_snapshot, reward_value_vnd_snapshot, reward_brand_snapshot, reward_is_service_snapshot, delivery_info)
    values (p_user_id, v_reward.id, v_reward.title, v_reward.points_cost, trim(p_idempotency_key),
      v_reward.reward_type, v_reward.value_vnd, v_reward.brand, v_reward.is_service, v_delivery)
    returning * into v_redemption;
  insert into public.candidate_reward_ledger(user_id, event_type, points_delta, source_reference, description)
    values (p_user_id, 'redemption', -v_reward.points_cost, v_redemption.id::text, 'Đổi quà: ' || v_reward.title);
  if v_reward.stock_remaining is not null then
    update public.candidate_reward_catalog set stock_remaining = stock_remaining - 1, updated_at = now()
      where id = v_reward.id;
  end if;
  return v_redemption;
end;
$$;

revoke all on function public.request_candidate_reward_redemption(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.request_candidate_reward_redemption(uuid, uuid, text, jsonb) to service_role;
