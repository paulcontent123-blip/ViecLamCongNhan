-- M6.1 follow-up: learner applications use an isolated table and quota ledger.
-- Existing employer applications and public vocational inquiry APIs are unchanged.

create table if not exists public.vocational_applications (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.vocational_courses(id) on delete cascade,
  provider_id uuid not null references public.training_providers(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'viewed', 'contacted', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, phone)
);

create table if not exists public.training_provider_application_contact_views (
  provider_id uuid not null references public.training_providers(id) on delete cascade,
  application_id uuid not null references public.vocational_applications(id) on delete cascade,
  period_start date not null,
  created_at timestamptz not null default now(),
  primary key (provider_id, application_id, period_start)
);

create index if not exists vocational_applications_provider_idx
  on public.vocational_applications(provider_id, status, created_at desc, id desc);

alter table public.vocational_applications enable row level security;
alter table public.training_provider_application_contact_views enable row level security;

revoke all on public.vocational_applications,
  public.training_provider_application_contact_views
  from anon, authenticated;

create or replace function public.view_vocational_application_contact(
  p_provider_id uuid,
  p_application_id uuid,
  p_period_start date
) returns table(phone text, email text, viewed_count integer, view_limit integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_provider public.training_providers%rowtype;
  v_application public.vocational_applications%rowtype;
  v_limit integer;
  v_count integer;
begin
  select * into v_provider from public.training_providers
    where id = p_provider_id for update;
  if not found then raise exception 'PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'PROVIDER_UNVERIFIED'; end if;

  if v_provider.account_type <> 'free'
     and v_provider.account_tier_expires_at is not null
     and v_provider.account_tier_expires_at <= now() then
    update public.training_providers
      set account_type = 'free', account_tier_expires_at = null
      where id = p_provider_id;
    v_provider.account_type := 'free';
  end if;
  v_limit := case v_provider.account_type
    when 'premium' then 300
    when 'basic' then 60
    else 0
  end;

  select * into v_application from public.vocational_applications
    where id = p_application_id and provider_id = p_provider_id;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;

  select count(*)::integer into v_count
    from public.training_provider_application_contact_views
    where provider_id = p_provider_id and period_start = p_period_start;
  if exists (
    select 1 from public.training_provider_application_contact_views
    where provider_id = p_provider_id
      and application_id = p_application_id
      and period_start = p_period_start
  ) then
    return query select v_application.phone, v_application.email, v_count, v_limit;
    return;
  end if;
  if v_count >= v_limit then raise exception 'CONTACT_LIMIT'; end if;

  insert into public.training_provider_application_contact_views
    (provider_id, application_id, period_start)
    values (p_provider_id, p_application_id, p_period_start);
  v_count := v_count + 1;
  return query select v_application.phone, v_application.email, v_count, v_limit;
end;
$$;

revoke all on function public.view_vocational_application_contact(uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public.view_vocational_application_contact(uuid, uuid, date)
  to service_role;
