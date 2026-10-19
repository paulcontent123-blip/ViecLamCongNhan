-- Mobile worker accounts: one-time codes and links to existing guest profiles.
alter table public.candidates
  add column if not exists user_id uuid references public.users(id) on delete set null;

create index if not exists candidates_user_id_idx on public.candidates(user_id);

-- Normalize common Vietnamese phone formatting so OTP ownership can safely link
-- existing guest applications created with spaces, punctuation, or country code.
update public.candidates
set phone = case
  when regexp_replace(phone, '\D', '', 'g') like '0084%' then '0' || substring(regexp_replace(phone, '\D', '', 'g') from 5)
  when regexp_replace(phone, '\D', '', 'g') like '84%' then '0' || substring(regexp_replace(phone, '\D', '', 'g') from 3)
  else regexp_replace(phone, '\D', '', 'g')
end
where phone is distinct from case
  when regexp_replace(phone, '\D', '', 'g') like '0084%' then '0' || substring(regexp_replace(phone, '\D', '', 'g') from 5)
  when regexp_replace(phone, '\D', '', 'g') like '84%' then '0' || substring(regexp_replace(phone, '\D', '', 'g') from 3)
  else regexp_replace(phone, '\D', '', 'g')
end;

create table if not exists public.candidate_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  consumed_at timestamptz,
  revoked_at timestamptz
);

create index if not exists candidate_otp_phone_created_idx
  on public.candidate_otp_challenges(phone, created_at desc);
create index if not exists candidate_otp_ip_created_idx
  on public.candidate_otp_challenges(ip_hash, created_at desc);

alter table public.candidate_otp_challenges enable row level security;

create or replace function public.normalize_vn_phone(p_phone text) returns text
language sql immutable parallel safe
as $$
  select case
    when digits like '0084%' then '0' || substring(digits from 5)
    when digits like '84%' then '0' || substring(digits from 3)
    else digits
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits) normalized;
$$;

create index if not exists candidates_phone_normalized_idx
  on public.candidates(public.normalize_vn_phone(phone));

revoke all on function public.normalize_vn_phone(text) from public, anon, authenticated;
grant execute on function public.normalize_vn_phone(text) to service_role;

-- Atomic per-phone cooldown/rate limit. The API uses the service-role client only.
create or replace function public.issue_candidate_otp(
  p_phone text,
  p_code_hash text,
  p_ip_hash text,
  p_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_phone, 0));
  perform pg_advisory_xact_lock(hashtextextended('ip:' || p_ip_hash, 0));
  delete from public.candidate_otp_challenges where created_at < now() - interval '30 days';

  if (select count(*) from public.candidate_otp_challenges
      where phone = p_phone and created_at > now() - interval '24 hours') >= 5
     or (select count(*) from public.candidate_otp_challenges
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 20
     or exists (select 1 from public.candidate_otp_challenges
      where phone = p_phone and created_at > now() - interval '60 seconds') then
    return null;
  end if;

  insert into public.candidate_otp_challenges(phone, code_hash, ip_hash, expires_at)
    values (p_phone, p_code_hash, p_ip_hash, p_expires_at)
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.issue_candidate_otp(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_candidate_otp(text, text, text, timestamptz) to service_role;

-- Consume the code, create/restore the candidate account and link guest profiles
-- in one transaction, so a successful OTP cannot leave a half-linked account.
create or replace function public.complete_candidate_otp(
  p_phone text,
  p_code_hash text
) returns table (valid boolean, account_conflict boolean, user_id uuid, full_name text)
language plpgsql security definer set search_path = public
as $$
declare
  v_challenge public.candidate_otp_challenges%rowtype;
  v_user public.users%rowtype;
  v_name text;
begin
  select * into v_challenge
    from public.candidate_otp_challenges
    where phone = p_phone and consumed_at is null and revoked_at is null
      and expires_at > now() and attempt_count < 5
    order by created_at desc
    limit 1 for update;

  if not found then
    return query select false, false, null::uuid, null::text;
    return;
  end if;

  if v_challenge.code_hash <> p_code_hash then
    update public.candidate_otp_challenges
      set attempt_count = attempt_count + 1,
          consumed_at = case when attempt_count + 1 >= 5 then now() else null end
      where id = v_challenge.id;
    return query select false, false, null::uuid, null::text;
    return;
  end if;
  update public.candidate_otp_challenges set consumed_at = now() where id = v_challenge.id;

  select * into v_user from public.users
    where public.normalize_vn_phone(phone) = p_phone
    order by created_at desc limit 1 for update;
  if found and v_user.role <> 'candidate' then
    return query select false, true, null::uuid, null::text;
    return;
  end if;

  select c.full_name into v_name from public.candidates c
    where public.normalize_vn_phone(c.phone) = p_phone
    order by c.created_at desc limit 1;
  if not found then v_name := 'Công nhân'; end if;

  if v_user.id is null then
    insert into public.users(phone, full_name, role, is_verified, status)
      values (p_phone, v_name, 'candidate', true, 'active')
      returning * into v_user;
  else
    v_name := coalesce(nullif(v_user.full_name, ''), v_name);
    update public.users set is_verified = true, status = 'active'
      where id = v_user.id returning * into v_user;
  end if;

  update public.candidates c set user_id = v_user.id
    where public.normalize_vn_phone(c.phone) = p_phone
      and (c.user_id is null or c.user_id = v_user.id);

  return query select true, false, v_user.id, v_name;
end;
$$;

revoke all on function public.complete_candidate_otp(text, text) from public, anon, authenticated;
grant execute on function public.complete_candidate_otp(text, text) to service_role;

-- Account deletion, dependent application deletion and apply-count adjustment are atomic.
create or replace function public.delete_candidate_account(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.users%rowtype;
begin
  select * into v_user from public.users where id = p_user_id for update;
  if not found or v_user.role <> 'candidate' then return false; end if;

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
  update public.users set status = 'deleted', is_verified = false where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.delete_candidate_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_candidate_account(uuid) to service_role;
