-- Nhà tuyển dụng xem được hồ sơ của ứng viên đã ỨNG TUYỂN vào tin của mình, kể cả công nhân có tài khoản.
-- Trước đây hàm chỉ cho xem hồ sơ có source = 'quick_form' (kho ứng viên). Ứng viên ứng tuyển vào một tin (source = 'job_apply')
-- hoặc có tài khoản (worker_*) bị báo "không tìm thấy hồ sơ" dù đã nộp đơn vào tin của nhà tuyển dụng.
-- Chỉ MỞ RỘNG điều kiện (quick_form HOẶC đã ứng tuyển vào chính nhà tuyển dụng này); hạn mức xem, khóa và cách tính giữ nguyên.
CREATE OR REPLACE FUNCTION public.record_employer_candidate_profile_view(p_employer_id uuid, p_candidate_id uuid, p_period_start date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    where id = p_candidate_id
      and (
        source = 'quick_form'
        -- Ứng viên đã ứng tuyển vào tin của CHÍNH nhà tuyển dụng này (kể cả công nhân có tài khoản) cũng xem được.
        or exists (
          select 1 from public.applications a
          where a.candidate_id = p_candidate_id and a.employer_id = p_employer_id
        )
      )
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
$function$;

revoke all on function public.record_employer_candidate_profile_view(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.record_employer_candidate_profile_view(uuid, uuid, date) to service_role;
