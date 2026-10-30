-- Quà đổi điểm có 3 dạng: thẻ quà (gift_card, ví dụ thẻ Bách hóa xanh), tiền mặt/chuyển khoản (cash),
-- hiện vật hoặc dịch vụ (physical). Mỗi dạng cần thông tin nhận quà khác nhau khi công nhân đổi
-- và thông tin trao quà khác nhau khi Admin xử lý. Quà đã có trước đó mặc định là 'physical'.

-- 1) Danh mục quà.
alter table public.candidate_reward_catalog
  add column if not exists reward_type text not null default 'physical'
    check (reward_type in ('gift_card', 'cash', 'physical')),
  add column if not exists value_vnd integer
    check (value_vnd is null or value_vnd between 1 and 1000000000),
  add column if not exists brand text
    check (brand is null or char_length(trim(brand)) between 1 and 80),
  add column if not exists is_service boolean not null default false;

alter table public.candidate_reward_catalog drop constraint if exists candidate_reward_catalog_type_fields_check;
alter table public.candidate_reward_catalog add constraint candidate_reward_catalog_type_fields_check check (
  (reward_type <> 'gift_card' or (value_vnd is not null and brand is not null))
  and (reward_type <> 'cash' or value_vnd is not null)
);

-- 2) Yêu cầu đổi quà: lưu ảnh chụp loại quà tại thời điểm đổi, thông tin nhận quà (công nhân nhập)
--    và thông tin trao quà (Admin nhập). delivery_info chứa dữ liệu nhạy cảm (tài khoản ngân hàng, địa chỉ).
alter table public.candidate_reward_redemptions
  add column if not exists reward_type_snapshot text not null default 'physical'
    check (reward_type_snapshot in ('gift_card', 'cash', 'physical')),
  add column if not exists reward_value_vnd_snapshot integer,
  add column if not exists reward_brand_snapshot text,
  add column if not exists reward_is_service_snapshot boolean not null default false,
  add column if not exists delivery_info jsonb,
  add column if not exists fulfillment_info jsonb;

-- 3) Tạo yêu cầu đổi quà: kiểm tra thông tin nhận quà theo loại.
drop function if exists public.request_candidate_reward_redemption(uuid, uuid, text);

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

-- 4) Xử lý yêu cầu: ghi nhận trao quà phải có thông tin theo loại (mã thẻ / mã chuyển khoản).
drop function if exists public.process_candidate_reward_redemption(uuid, uuid, text, text, text);

create or replace function public.process_candidate_reward_redemption(
  p_redemption_id uuid,
  p_admin_id uuid,
  p_expected_status text,
  p_next_status text,
  p_admin_note text default null,
  p_fulfillment_info jsonb default null
) returns public.candidate_reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare
  v_redemption public.candidate_reward_redemptions%rowtype;
  v_fulfillment jsonb := null;
begin
  if p_redemption_id is null or p_expected_status is null
     or p_next_status is null or p_next_status not in ('approved', 'rejected', 'fulfilled')
     or (p_admin_note is not null and char_length(p_admin_note) > 1000)
     or (p_fulfillment_info is not null and jsonb_typeof(p_fulfillment_info) <> 'object') then
    raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_STATUS_INVALID';
  end if;
  if not exists (select 1 from public.users u where u.id = p_admin_id and u.role = 'admin' and u.status = 'active') then
    raise exception using errcode = '42501', message = 'CANDIDATE_REWARD_ADMIN_INVALID';
  end if;

  select * into v_redemption from public.candidate_reward_redemptions where id = p_redemption_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CANDIDATE_REWARD_REDEMPTION_NOT_FOUND'; end if;
  if v_redemption.status is distinct from p_expected_status then
    raise exception using errcode = '40001', message = 'CANDIDATE_REWARD_STATUS_CONFLICT';
  end if;
  if (v_redemption.status = 'pending' and p_next_status not in ('approved', 'rejected'))
     or (v_redemption.status = 'approved' and p_next_status <> 'fulfilled')
     or v_redemption.status in ('rejected', 'fulfilled') then
    raise exception using errcode = 'P0001', message = 'CANDIDATE_REWARD_STATUS_CONFLICT';
  end if;

  if p_next_status = 'fulfilled' then
    if v_redemption.reward_type_snapshot = 'gift_card' then
      if coalesce(char_length(trim(p_fulfillment_info->>'voucherCode')), 0) not between 3 and 200
         or coalesce(char_length(p_fulfillment_info->>'note'), 0) > 300 then
        raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_FULFILLMENT_INVALID';
      end if;
      v_fulfillment := jsonb_strip_nulls(jsonb_build_object(
        'voucherCode', trim(p_fulfillment_info->>'voucherCode'),
        'note', nullif(trim(p_fulfillment_info->>'note'), '')));
    elsif v_redemption.reward_type_snapshot = 'cash' then
      if coalesce(char_length(trim(p_fulfillment_info->>'transferReference')), 0) not between 3 and 200
         or coalesce(char_length(p_fulfillment_info->>'note'), 0) > 300 then
        raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_FULFILLMENT_INVALID';
      end if;
      v_fulfillment := jsonb_strip_nulls(jsonb_build_object(
        'transferReference', trim(p_fulfillment_info->>'transferReference'),
        'note', nullif(trim(p_fulfillment_info->>'note'), '')));
    else
      if coalesce(char_length(p_fulfillment_info->>'note'), 0) > 300 then
        raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_FULFILLMENT_INVALID';
      end if;
      v_fulfillment := jsonb_strip_nulls(jsonb_build_object('note', nullif(trim(p_fulfillment_info->>'note'), '')));
      if v_fulfillment = '{}'::jsonb then v_fulfillment := null; end if;
    end if;
  end if;

  if p_next_status = 'rejected' then
    insert into public.candidate_reward_ledger(user_id, event_type, points_delta, source_reference, description)
      values (v_redemption.user_id, 'redemption_refund', v_redemption.points_cost,
        v_redemption.id::text, 'Hoàn điểm do yêu cầu đổi quà bị từ chối');
    update public.candidate_reward_catalog set stock_remaining = stock_remaining + 1, updated_at = now()
      where id = v_redemption.reward_id and stock_remaining is not null;
  end if;

  update public.candidate_reward_redemptions set status = p_next_status,
    admin_note = nullif(trim(p_admin_note), ''), processed_by = p_admin_id,
    processed_at = now(), updated_at = now(),
    fulfillment_info = case when p_next_status = 'fulfilled' then v_fulfillment else fulfillment_info end
    where id = p_redemption_id returning * into v_redemption;
  return v_redemption;
end;
$$;

revoke all on function public.request_candidate_reward_redemption(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.process_candidate_reward_redemption(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.request_candidate_reward_redemption(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.process_candidate_reward_redemption(uuid, uuid, text, text, text, jsonb) to service_role;
