-- Tự ngắt khi không thao tác: app dừng gửi heartbeat nếu người dùng không chạm màn hình quá idle_timeout_seconds,
-- chạm lại thì tính tiếp. Giá trị lấy từ cài đặt nên đổi được bất cứ lúc nào (app đọc lại ở mỗi heartbeat).
-- Đây là biện pháp phía app: server không kiểm chứng được thao tác, chỉ cung cấp ngưỡng.

alter table public.candidate_online_point_settings
  add column if not exists idle_timeout_seconds integer not null default 180
  check (idle_timeout_seconds between 30 and 3600);

drop function if exists public.record_candidate_presence(uuid);

create or replace function public.record_candidate_presence(p_user_id uuid)
returns table (awarded integer, today_points integer, daily_cap integer, seconds_online integer, is_enabled boolean, idle_timeout_seconds integer)
language plpgsql security definer set search_path = public
as $$
declare
  s public.candidate_online_point_settings%rowtype;
  d public.candidate_online_daily%rowtype;
  v_now timestamptz := now();
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_gap integer;
  v_seconds integer;
  v_earned integer;
  v_award integer := 0;
begin
  if p_user_id is null
     or not exists (select 1 from public.users u where u.id = p_user_id and u.role = 'candidate' and u.status = 'active') then
    raise exception using errcode = '42501', message = 'CANDIDATE_ONLINE_USER_INVALID';
  end if;

  select * into s from public.candidate_online_point_settings where id = true;
  perform pg_advisory_xact_lock(hashtextextended('candidate-online:' || p_user_id::text, 0));

  insert into public.candidate_online_daily(user_id, day) values (p_user_id, v_day) on conflict do nothing;
  select * into d from public.candidate_online_daily where user_id = p_user_id and day = v_day for update;

  if not s.enabled then
    return query select 0, d.awarded_points, s.daily_points_cap, d.online_seconds, false, s.idle_timeout_seconds;
    return;
  end if;

  v_seconds := d.online_seconds;
  if d.last_heartbeat_at is not null then
    v_gap := floor(extract(epoch from (v_now - d.last_heartbeat_at)))::integer;
    if v_gap < s.min_gap_seconds then
      return query select 0, d.awarded_points, s.daily_points_cap, d.online_seconds, true, s.idle_timeout_seconds;
      return;
    end if;
    if v_gap <= s.max_gap_seconds then v_seconds := v_seconds + v_gap; end if;
  end if;

  v_earned := least(s.daily_points_cap, (v_seconds / (s.interval_minutes * 60)) * s.points_per_interval);
  v_award := greatest(0, v_earned - d.awarded_points);

  update public.candidate_online_daily
    set online_seconds = v_seconds, last_heartbeat_at = v_now,
        awarded_points = d.awarded_points + v_award, updated_at = v_now
    where user_id = p_user_id and day = v_day;

  if v_award > 0 then
    insert into public.candidate_reward_ledger(user_id, event_type, points_delta, source_reference, description)
      values (p_user_id, 'online_session', v_award, v_day::text || ':' || (d.awarded_points + v_award)::text,
        'Điểm online ngày ' || to_char(v_day, 'DD/MM/YYYY'));
  end if;

  return query select v_award, d.awarded_points + v_award, s.daily_points_cap, v_seconds, true, s.idle_timeout_seconds;
end;
$$;

revoke all on function public.record_candidate_presence(uuid) from public, anon, authenticated;
grant execute on function public.record_candidate_presence(uuid) to service_role;
