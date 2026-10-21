-- Kho người thuê cho Đối tác Thuê trọ: công nhân đã xác minh chủ động đồng ý cho Chủ trọ xem hồ sơ tóm tắt,
-- Chủ trọ mở SĐT/Zalo theo hạn mức của gói (Free 0, Basic 60, Premium 300 mỗi tháng).
-- Sự đồng ý này tách riêng với đồng ý của Kho học viên; sổ lượt xem cũng tách riêng.
-- Cần migration 20261022100001_rental_provider_commerce.sql (cột gói của rental_providers) áp dụng trước.

-- Candidate visibility is opt-in, scoped to verified rental providers, and can
-- be revoked by the worker at any time.
create table if not exists public.candidate_rental_visibility_consents (
  user_id uuid primary key references public.users(id) on delete cascade,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.rental_provider_tenant_views (
  provider_id uuid not null references public.rental_providers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  period_start date not null,
  created_at timestamptz not null default now(),
  primary key (provider_id, user_id, period_start)
);

create index if not exists rental_provider_tenant_views_period_idx
  on public.rental_provider_tenant_views(provider_id, period_start);

alter table public.candidate_rental_visibility_consents enable row level security;
alter table public.rental_provider_tenant_views enable row level security;
revoke all on public.candidate_rental_visibility_consents,
  public.rental_provider_tenant_views from anon, authenticated;

create or replace function public.list_rental_provider_tenant_profiles(
  p_provider_id uuid,
  p_province text,
  p_query text,
  p_limit integer,
  p_offset integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_items jsonb;
  v_total integer;
begin
  if not exists (select 1 from public.rental_providers where id = p_provider_id and is_verified) then
    raise exception 'PROVIDER_UNVERIFIED';
  end if;

  with latest_profiles as (
    select distinct on (c.user_id)
      c.id, c.user_id, c.full_name, c.province, c.desired_industry,
      c.desired_salary_min, c.experience_years, c.created_at
    from public.candidates c
    join public.candidate_rental_visibility_consents consent
      on consent.user_id = c.user_id and consent.revoked_at is null
    join public.users u
      on u.id = c.user_id and u.role = 'candidate' and u.status = 'active' and u.is_verified
    where c.user_id is not null
    order by c.user_id, c.created_at desc, c.id desc
  ), filtered as (
    select * from latest_profiles p
    where (nullif(trim(p_province), '') is null or coalesce(p.province, '') ilike '%' || trim(p_province) || '%')
      and (nullif(trim(p_query), '') is null or
        p.full_name ilike '%' || trim(p_query) || '%' or
        coalesce(p.desired_industry, '') ilike '%' || trim(p_query) || '%' or
        coalesce(p.province, '') ilike '%' || trim(p_query) || '%')
  )
  select count(*)::integer into v_total from filtered;

  with latest_profiles as (
    select distinct on (c.user_id)
      c.id, c.user_id, c.full_name, c.province, c.desired_industry,
      c.desired_salary_min, c.experience_years, c.created_at
    from public.candidates c
    join public.candidate_rental_visibility_consents consent
      on consent.user_id = c.user_id and consent.revoked_at is null
    join public.users u
      on u.id = c.user_id and u.role = 'candidate' and u.status = 'active' and u.is_verified
    where c.user_id is not null
    order by c.user_id, c.created_at desc, c.id desc
  ), filtered as (
    select * from latest_profiles p
    where (nullif(trim(p_province), '') is null or coalesce(p.province, '') ilike '%' || trim(p_province) || '%')
      and (nullif(trim(p_query), '') is null or
        p.full_name ilike '%' || trim(p_query) || '%' or
        coalesce(p.desired_industry, '') ilike '%' || trim(p_query) || '%' or
        coalesce(p.province, '') ilike '%' || trim(p_query) || '%')
  )
  select coalesce(jsonb_agg(to_jsonb(page)), '[]'::jsonb) into v_items
  from (
    select id, full_name, province, desired_industry, desired_salary_min, experience_years, created_at
    from filtered order by created_at desc, id desc
    limit greatest(1, least(coalesce(p_limit, 20), 50))
    offset greatest(coalesce(p_offset, 0), 0)
  ) page;

  return jsonb_build_object('items', v_items, 'total', v_total);
end;
$$;

revoke all on function public.list_rental_provider_tenant_profiles(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.list_rental_provider_tenant_profiles(uuid, text, text, integer, integer)
  to service_role;

create or replace function public.view_rental_provider_tenant_contact(
  p_provider_id uuid,
  p_candidate_id uuid,
  p_period_start date
) returns table(phone text, zalo text, viewed_count integer, view_limit integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_provider public.rental_providers%rowtype;
  v_candidate public.candidates%rowtype;
  v_phone text;
  v_limit integer;
  v_count integer;
begin
  select * into v_provider from public.rental_providers where id = p_provider_id for update;
  if not found then raise exception 'PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'PROVIDER_UNVERIFIED'; end if;

  if v_provider.account_type <> 'free'
     and v_provider.account_tier_expires_at is not null
     and v_provider.account_tier_expires_at <= now() then
    update public.rental_providers set account_type = 'free', account_tier_expires_at = null where id = p_provider_id;
    v_provider.account_type := 'free';
  end if;
  v_limit := case v_provider.account_type when 'premium' then 300 when 'basic' then 60 else 0 end;

  select c.* into v_candidate
  from public.candidates c
  join public.candidate_rental_visibility_consents consent
    on consent.user_id = c.user_id and consent.revoked_at is null
  join public.users u
    on u.id = c.user_id and u.role = 'candidate' and u.status = 'active' and u.is_verified
  where c.id = p_candidate_id and c.user_id is not null
  for share of consent, u;
  if not found then raise exception 'CANDIDATE_NOT_AVAILABLE'; end if;

  select u.phone into v_phone
  from public.users u
  where u.id = v_candidate.user_id and u.role = 'candidate' and u.status = 'active' and u.is_verified;
  if v_phone is null then raise exception 'CANDIDATE_NOT_AVAILABLE'; end if;

  select count(*)::integer into v_count
  from public.rental_provider_tenant_views
  where provider_id = p_provider_id and period_start = p_period_start;

  if exists (
    select 1 from public.rental_provider_tenant_views
    where provider_id = p_provider_id and user_id = v_candidate.user_id and period_start = p_period_start
  ) then
    return query select v_phone, v_candidate.zalo, v_count, v_limit;
    return;
  end if;
  if v_count >= v_limit then raise exception 'CONTACT_LIMIT'; end if;

  insert into public.rental_provider_tenant_views(provider_id, user_id, candidate_id, period_start)
  values (p_provider_id, v_candidate.user_id, v_candidate.id, p_period_start);
  v_count := v_count + 1;
  return query select v_phone, v_candidate.zalo, v_count, v_limit;
end;
$$;

revoke all on function public.view_rental_provider_tenant_contact(uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public.view_rental_provider_tenant_contact(uuid, uuid, date)
  to service_role;
