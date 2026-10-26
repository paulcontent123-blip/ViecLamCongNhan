-- Candidate rewards foundation. Earning rules start disabled because point values,
-- expiration and qualification criteria are pending product approval.

create table if not exists public.candidate_reward_rules (
  event_type text primary key check (event_type in ('application', 'referral', 'marketplace_transaction')),
  points integer not null default 0 check (points between 0 and 100000),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not enabled or points > 0)
);

insert into public.candidate_reward_rules(event_type, points, enabled)
values ('application', 0, false), ('referral', 0, false), ('marketplace_transaction', 0, false)
on conflict (event_type) do nothing;

create table if not exists public.candidate_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'application', 'referral', 'marketplace_transaction', 'redemption', 'redemption_refund', 'admin_adjustment'
  )),
  points_delta integer not null check (points_delta <> 0),
  source_reference text not null check (char_length(trim(source_reference)) between 1 and 200),
  description text not null check (char_length(trim(description)) between 1 and 300),
  created_at timestamptz not null default now(),
  constraint candidate_reward_ledger_event_source_unique unique (user_id, event_type, source_reference)
);

create index if not exists candidate_reward_ledger_user_created_idx
  on public.candidate_reward_ledger(user_id, created_at desc);

create table if not exists public.candidate_reward_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  image_url text,
  points_cost integer not null check (points_cost between 1 and 10000000),
  stock_remaining integer check (stock_remaining is null or stock_remaining >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_reward_catalog_active_idx
  on public.candidate_reward_catalog(is_active, created_at desc);

create table if not exists public.candidate_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  reward_id uuid not null references public.candidate_reward_catalog(id) on delete restrict,
  reward_title_snapshot text not null,
  points_cost integer not null check (points_cost > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'fulfilled')),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 100),
  admin_note text,
  processed_by uuid references public.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_reward_redemption_idempotency_unique unique (user_id, idempotency_key)
);

create index if not exists candidate_reward_redemptions_user_created_idx
  on public.candidate_reward_redemptions(user_id, created_at desc);
create index if not exists candidate_reward_redemptions_status_created_idx
  on public.candidate_reward_redemptions(status, created_at desc);

alter table public.candidate_reward_rules enable row level security;
alter table public.candidate_reward_ledger enable row level security;
alter table public.candidate_reward_catalog enable row level security;
alter table public.candidate_reward_redemptions enable row level security;
revoke all on public.candidate_reward_rules, public.candidate_reward_ledger,
  public.candidate_reward_catalog, public.candidate_reward_redemptions from public, anon, authenticated;
grant all on public.candidate_reward_rules, public.candidate_reward_ledger,
  public.candidate_reward_catalog, public.candidate_reward_redemptions to service_role;

create or replace function public.prevent_candidate_reward_ledger_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception using errcode = '55000', message = 'CANDIDATE_REWARD_LEDGER_IMMUTABLE';
end;
$$;

drop trigger if exists candidate_reward_ledger_immutable on public.candidate_reward_ledger;
create trigger candidate_reward_ledger_immutable
  before update or delete on public.candidate_reward_ledger
  for each row execute function public.prevent_candidate_reward_ledger_mutation();

create or replace function public.award_candidate_reward(
  p_user_id uuid,
  p_event_type text,
  p_source_reference text,
  p_description text
) returns table (awarded boolean, points integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_points integer;
  v_ledger_id uuid;
begin
  if p_user_id is null
     or p_event_type is null or p_event_type not in ('application', 'referral', 'marketplace_transaction')
     or p_source_reference is null or char_length(trim(p_source_reference)) not between 1 and 200
     or p_description is null or char_length(trim(p_description)) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'CANDIDATE_REWARD_EVENT_INVALID';
  end if;

  select r.points into v_points
    from public.candidate_reward_rules r
    where r.event_type = p_event_type and r.enabled = true and r.points > 0;
  if not found then return query select false, 0; return; end if;

  if not exists (select 1 from public.users u where u.id = p_user_id and u.role = 'candidate' and u.status = 'active') then
    raise exception using errcode = '42501', message = 'CANDIDATE_REWARD_USER_INVALID';
  end if;

  insert into public.candidate_reward_ledger(user_id, event_type, points_delta, source_reference, description)
    values (p_user_id, p_event_type, v_points, trim(p_source_reference), trim(p_description))
    on conflict (user_id, event_type, source_reference) do nothing
    returning id into v_ledger_id;
  return query select v_ledger_id is not null, case when v_ledger_id is null then 0 else v_points end;
end;
$$;

create or replace function public.get_candidate_reward_balance(p_user_id uuid)
returns bigint
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(points_delta), 0)::bigint
  from public.candidate_reward_ledger
  where user_id = p_user_id;
$$;

create or replace function public.request_candidate_reward_redemption(
  p_user_id uuid,
  p_reward_id uuid,
  p_idempotency_key text
) returns public.candidate_reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare
  v_existing public.candidate_reward_redemptions%rowtype;
  v_reward public.candidate_reward_catalog%rowtype;
  v_redemption public.candidate_reward_redemptions%rowtype;
  v_balance bigint;
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
  select coalesce(sum(points_delta), 0) into v_balance from public.candidate_reward_ledger where user_id = p_user_id;
  if v_balance < v_reward.points_cost then
    raise exception using errcode = 'P0001', message = 'CANDIDATE_REWARD_INSUFFICIENT_POINTS';
  end if;

  insert into public.candidate_reward_redemptions(user_id, reward_id, reward_title_snapshot, points_cost, idempotency_key)
    values (p_user_id, v_reward.id, v_reward.title, v_reward.points_cost, trim(p_idempotency_key))
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

create or replace function public.process_candidate_reward_redemption(
  p_redemption_id uuid,
  p_admin_id uuid,
  p_expected_status text,
  p_next_status text,
  p_admin_note text default null
) returns public.candidate_reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare
  v_redemption public.candidate_reward_redemptions%rowtype;
begin
  if p_redemption_id is null or p_expected_status is null
     or p_next_status is null or p_next_status not in ('approved', 'rejected', 'fulfilled')
     or (p_admin_note is not null and char_length(p_admin_note) > 1000) then
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

  if p_next_status = 'rejected' then
    insert into public.candidate_reward_ledger(user_id, event_type, points_delta, source_reference, description)
      values (v_redemption.user_id, 'redemption_refund', v_redemption.points_cost,
        v_redemption.id::text, 'Hoàn điểm do yêu cầu đổi quà bị từ chối');
    update public.candidate_reward_catalog set stock_remaining = stock_remaining + 1, updated_at = now()
      where id = v_redemption.reward_id and stock_remaining is not null;
  end if;

  update public.candidate_reward_redemptions set status = p_next_status,
    admin_note = nullif(trim(p_admin_note), ''), processed_by = p_admin_id,
    processed_at = now(), updated_at = now()
    where id = p_redemption_id returning * into v_redemption;
  return v_redemption;
end;
$$;

create or replace function public.award_candidate_reward_after_application()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.candidates where id = new.candidate_id;
  if v_user_id is not null then
    perform public.award_candidate_reward(v_user_id, 'application', new.id::text, 'Gửi hồ sơ ứng tuyển');
  end if;
  return new;
end;
$$;

drop trigger if exists applications_award_candidate_reward on public.applications;
create trigger applications_award_candidate_reward
  after insert on public.applications
  for each row execute function public.award_candidate_reward_after_application();

revoke all on function public.prevent_candidate_reward_ledger_mutation() from public, anon, authenticated;
revoke all on function public.award_candidate_reward(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.get_candidate_reward_balance(uuid) from public, anon, authenticated;
revoke all on function public.request_candidate_reward_redemption(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.process_candidate_reward_redemption(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.award_candidate_reward_after_application() from public, anon, authenticated;
grant execute on function public.award_candidate_reward(uuid, text, text, text) to service_role;
grant execute on function public.get_candidate_reward_balance(uuid) to service_role;
grant execute on function public.request_candidate_reward_redemption(uuid, uuid, text) to service_role;
grant execute on function public.process_candidate_reward_redemption(uuid, uuid, text, text, text) to service_role;
