-- Điểm thưởng theo thời gian online: mặc định +1 điểm mỗi 5 phút, tối đa 10 điểm/ngày.
-- Mọi tham số nằm trong candidate_online_point_settings và đổi được bất cứ lúc nào (có hiệu lực ở lần heartbeat kế tiếp).
-- Server tự tính thời gian từ mốc heartbeat của chính nó; không tin số phút do client gửi.
-- Các rule điểm cũ (ứng tuyển, giới thiệu, giao dịch Chợ) được tắt.

-- 1) Cho phép loại sự kiện 'online_session' trong sổ điểm.
do $$
declare
  v_name text;
begin
  for v_name in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.candidate_reward_ledger'::regclass
      and c.contype = 'c' and pg_get_constraintdef(c.oid) ilike '%event_type%'
  loop
    execute format('alter table public.candidate_reward_ledger drop constraint %I', v_name);
  end loop;
end $$;

alter table public.candidate_reward_ledger
  add constraint candidate_reward_ledger_event_type_check check (event_type in (
    'application', 'referral', 'marketplace_transaction', 'online_session',
    'redemption', 'redemption_refund', 'admin_adjustment'
  ));

-- 2) Tắt cách tính điểm cũ.
drop trigger if exists applications_award_candidate_reward on public.applications;
update public.candidate_reward_rules set enabled = false, updated_at = now() where enabled = true;

-- 3) Cài đặt (một dòng duy nhất).
create table if not exists public.candidate_online_point_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  points_per_interval integer not null default 1 check (points_per_interval between 1 and 1000),
  interval_minutes integer not null default 5 check (interval_minutes between 1 and 1440),
  daily_points_cap integer not null default 10 check (daily_points_cap between 1 and 100000),
  -- Hai heartbeat cách nhau quá max_gap_seconds thì khoảng đó không được tính (coi như thoát app / mất mạng).
  max_gap_seconds integer not null default 90 check (max_gap_seconds between 30 and 3600),
  -- Heartbeat dồn dập hơn min_gap_seconds bị bỏ qua, không ghi thêm.
  min_gap_seconds integer not null default 20 check (min_gap_seconds between 1 and 600),
  updated_at timestamptz not null default now(),
  check (min_gap_seconds < max_gap_seconds)
);
insert into public.candidate_online_point_settings(id) values (true) on conflict (id) do nothing;

-- 4) Thời gian online theo ngày (giờ Việt Nam).
create table if not exists public.candidate_online_daily (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  online_seconds integer not null default 0 check (online_seconds >= 0),
  last_heartbeat_at timestamptz,
  awarded_points integer not null default 0 check (awarded_points >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.candidate_online_point_settings enable row level security;
alter table public.candidate_online_daily enable row level security;
revoke all on public.candidate_online_point_settings, public.candidate_online_daily from public, anon, authenticated;
grant all on public.candidate_online_point_settings, public.candidate_online_daily to service_role;

-- 5) Ghi nhận heartbeat và cộng điểm.
create or replace function public.record_candidate_presence(p_user_id uuid)
returns table (awarded integer, today_points integer, daily_cap integer, seconds_online integer, is_enabled boolean)
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
    return query select 0, d.awarded_points, s.daily_points_cap, d.online_seconds, false;
    return;
  end if;

  v_seconds := d.online_seconds;
  if d.last_heartbeat_at is not null then
    v_gap := floor(extract(epoch from (v_now - d.last_heartbeat_at)))::integer;
    if v_gap < s.min_gap_seconds then
      return query select 0, d.awarded_points, s.daily_points_cap, d.online_seconds, true;
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

  return query select v_award, d.awarded_points + v_award, s.daily_points_cap, v_seconds, true;
end;
$$;

-- 6) Trạng thái cho màn Điểm: cài đặt đang áp dụng, điểm online hôm nay, điểm tích lũy trọn đời.
create or replace function public.get_candidate_online_status(p_user_id uuid)
returns table (enabled boolean, points_per_interval integer, interval_minutes integer, daily_points_cap integer,
               today_points integer, lifetime_points bigint)
language sql stable security definer set search_path = public
as $$
  select s.enabled, s.points_per_interval, s.interval_minutes, s.daily_points_cap,
    coalesce((select d.awarded_points from public.candidate_online_daily d
              where d.user_id = p_user_id and d.day = (now() at time zone 'Asia/Ho_Chi_Minh')::date), 0),
    coalesce((select sum(l.points_delta) from public.candidate_reward_ledger l
              where l.user_id = p_user_id and l.points_delta > 0 and l.event_type <> 'redemption_refund'), 0)::bigint
  from public.candidate_online_point_settings s where s.id = true;
$$;

revoke all on function public.record_candidate_presence(uuid) from public, anon, authenticated;
revoke all on function public.get_candidate_online_status(uuid) from public, anon, authenticated;
grant execute on function public.record_candidate_presence(uuid) to service_role;
grant execute on function public.get_candidate_online_status(uuid) to service_role;
