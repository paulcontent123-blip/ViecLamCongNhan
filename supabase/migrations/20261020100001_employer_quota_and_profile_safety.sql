-- Serialize employer quotas and keep cross-table profile writes atomic.
-- These functions are called only by server routes using the Supabase service role.

create or replace function public.create_employer_job_with_quota(
  p_employer_id uuid,
  p_slug text,
  p_job jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employer public.employers%rowtype;
  v_tier text;
  v_daily_limit integer;
  v_duration_days integer;
  v_posted_today integer;
  v_job_id uuid;
  v_order_id uuid;
  v_order_created_at timestamptz;
begin
  select * into v_employer
  from public.employers
  where id = p_employer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'employer_not_found');
  end if;
  if not v_employer.is_verified then
    return jsonb_build_object('ok', false, 'code', 'employer_not_verified');
  end if;

  v_tier := case
    when v_employer.account_type in ('basic', 'premium')
      and v_employer.account_tier_expires_at is not null
      and v_employer.account_tier_expires_at < now() then 'free'
    when v_employer.account_type in ('basic', 'premium') then v_employer.account_type
    else 'free'
  end;

  if v_tier = 'free' and v_employer.account_type <> 'free' then
    update public.employers
    set account_type = 'free', account_tier_expires_at = null
    where id = p_employer_id;
  end if;

  v_daily_limit := case v_tier when 'premium' then 10 when 'basic' then 3 else 1 end;
  v_duration_days := case when v_tier = 'free' then 14 else 30 end;

  select count(*)::integer into v_posted_today
  from public.jobs
  where employer_id = p_employer_id
    and created_at >= date_trunc('day', now());

  if v_posted_today >= v_daily_limit then
    return jsonb_build_object(
      'ok', false,
      'code', 'daily_limit',
      'tier', v_tier,
      'dailyLimit', v_daily_limit,
      'postedToday', v_posted_today
    );
  end if;

  insert into public.jobs (
    employer_id, slug, title, description, requirements, salary_min, salary_max,
    job_type, province_code, district, kcn_id, industry, quantity, tier, status,
    is_urgent, has_housing, has_shuttle, has_meals, no_experience_required,
    shift_type, expires_at
  ) values (
    p_employer_id,
    p_slug,
    p_job->>'title',
    p_job->>'description',
    nullif(p_job->>'requirements', ''),
    nullif(p_job->>'salaryMin', '')::integer,
    nullif(p_job->>'salaryMax', '')::integer,
    nullif(p_job->>'jobType', ''),
    p_job->>'provinceCode',
    nullif(p_job->>'district', ''),
    nullif(p_job->>'kcnId', '')::uuid,
    p_job->>'industry',
    coalesce(nullif(p_job->>'quantity', '')::integer, 1),
    v_tier,
    'pending',
    coalesce((p_job->>'isUrgent')::boolean, false),
    coalesce((p_job->>'hasHousing')::boolean, false),
    coalesce((p_job->>'hasShuttle')::boolean, false),
    coalesce((p_job->>'hasMeals')::boolean, false),
    coalesce((p_job->>'noExperienceRequired')::boolean, false),
    nullif(p_job->>'shiftType', ''),
    now() + make_interval(days => v_duration_days)
  ) returning id into v_job_id;

  if coalesce((p_job->>'wantsCampaign')::boolean, false) then
    insert into public.orders (
      employer_id, order_type, tier, amount, payment_method, status, job_id, campaign_message
    ) values (
      p_employer_id,
      'job_post',
      'campaign',
      (p_job->>'campaignPrice')::integer,
      p_job->>'paymentMethod',
      'pending',
      v_job_id,
      p_job->>'campaignMessage'
    ) returning id, created_at into v_order_id, v_order_created_at;
  end if;

  return jsonb_build_object(
    'ok', true,
    'tier', v_tier,
    'job', jsonb_build_object('id', v_job_id, 'slug', p_slug),
    'order', case when v_order_id is null then null else jsonb_build_object(
      'id', v_order_id,
      'tier', 'campaign',
      'amount', (p_job->>'campaignPrice')::integer,
      'status', 'pending',
      'created_at', v_order_created_at
    ) end
  );
end;
$$;

create or replace function public.record_employer_candidate_profile_view(
  p_employer_id uuid,
  p_candidate_id uuid,
  p_period_start date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employer public.employers%rowtype;
  v_limit integer;
  v_viewed_count integer;
  v_existing boolean;
begin
  select * into v_employer
  from public.employers
  where id = p_employer_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'found', false, 'viewedCount', 0, 'limit', 0);
  end if;
  if not v_employer.is_verified then
    return jsonb_build_object('allowed', false, 'verified', false, 'viewedCount', 0, 'limit', 0);
  end if;
  if not exists (
    select 1 from public.candidates
    where id = p_candidate_id and source = 'quick_form'
  ) then
    return jsonb_build_object('allowed', false, 'found', false, 'viewedCount', 0, 'limit', 0);
  end if;

  if v_employer.account_type in ('basic', 'premium')
    and v_employer.account_tier_expires_at is not null
    and v_employer.account_tier_expires_at < now() then
    update public.employers
    set account_type = 'free', account_tier_expires_at = null
    where id = p_employer_id;
    v_employer.account_type := 'free';
  end if;

  v_limit := case v_employer.account_type when 'premium' then 300 when 'basic' then 60 else 0 end;

  -- The employer row lock serializes quota checks for this employer. The advisory
  -- lock also makes this safe if a future writer no longer locks the employer row.
  perform pg_advisory_xact_lock(hashtextextended(p_employer_id::text || ':' || p_period_start::text, 7319));

  select exists (
    select 1 from public.employer_candidate_views
    where employer_id = p_employer_id
      and candidate_id = p_candidate_id
      and period_start = p_period_start
  ) into v_existing;

  select count(*)::integer into v_viewed_count
  from public.employer_candidate_views
  where employer_id = p_employer_id and period_start = p_period_start;

  if v_existing then
    return jsonb_build_object('allowed', true, 'found', true, 'viewedCount', v_viewed_count, 'limit', v_limit);
  end if;
  if v_viewed_count >= v_limit then
    return jsonb_build_object('allowed', false, 'found', true, 'viewedCount', v_viewed_count, 'limit', v_limit);
  end if;

  insert into public.employer_candidate_views (employer_id, candidate_id, period_start)
  values (p_employer_id, p_candidate_id, p_period_start);

  return jsonb_build_object('allowed', true, 'found', true, 'viewedCount', v_viewed_count + 1, 'limit', v_limit);
end;
$$;

create or replace function public.update_employer_profile_atomically(
  p_employer_id uuid,
  p_user_id uuid,
  p_company_name text,
  p_contact_phone text,
  p_full_name text,
  p_tax_code text,
  p_province_code text,
  p_industry text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_verified boolean;
  v_updated integer;
begin
  select user_id, is_verified into v_user_id, v_verified
  from public.employers
  where id = p_employer_id
  for update;

  if not found or v_user_id is distinct from p_user_id or not coalesce(v_verified, false) then
    return false;
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    return false;
  end if;

  update public.employers
  set company_name = p_company_name,
      contact_phone = p_contact_phone,
      tax_code = p_tax_code,
      province_code = p_province_code,
      industry = p_industry
  where id = p_employer_id;

  update public.users
  set full_name = p_full_name, phone = p_contact_phone
  where id = p_user_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Employer profile user update failed';
  end if;

  -- Logo is intentionally excluded. It is changed only by the guarded upload route.
  return true;
end;
$$;

revoke all on function public.create_employer_job_with_quota(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_employer_candidate_profile_view(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.update_employer_profile_atomically(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_employer_job_with_quota(uuid, text, jsonb) to service_role;
grant execute on function public.record_employer_candidate_profile_view(uuid, uuid, date) to service_role;
grant execute on function public.update_employer_profile_atomically(uuid, uuid, text, text, text, text, text, text) to service_role;
