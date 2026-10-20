-- M6.1: isolated vocational providers, reviewed courses, and learner inquiries.
-- Existing employer tables and API routes remain unchanged.

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('candidate', 'employer', 'training_provider', 'agency', 'admin'));

create table if not exists public.training_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider_name text not null,
  provider_slug text not null unique,
  provider_type text not null default 'training_center',
  contact_name text not null,
  contact_phone text not null,
  province_code text,
  tax_code text,
  license_number text,
  description text,
  logo_url text,
  is_verified boolean not null default false,
  account_type text not null default 'free' check (account_type in ('free', 'basic', 'premium')),
  account_tier_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vocational_courses (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.training_providers(id) on delete cascade,
  title text not null,
  occupation text not null,
  level text,
  description text not null,
  requirements text,
  learning_mode text not null default 'onsite' check (learning_mode in ('onsite', 'online', 'hybrid')),
  province_code text,
  location text,
  start_date date,
  duration_text text,
  tuition_vnd bigint check (tuition_vnd is null or tuition_vnd >= 0),
  support_description text,
  certificate_name text,
  certificate_issuer text,
  capacity integer check (capacity is null or capacity >= 0),
  enrollment_deadline date,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'hidden', 'closed')),
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vocational_inquiries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.vocational_courses(id) on delete cascade,
  provider_id uuid not null references public.training_providers(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'advising', 'registered', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, phone)
);

create table if not exists public.training_provider_contact_views (
  provider_id uuid not null references public.training_providers(id) on delete cascade,
  inquiry_id uuid not null references public.vocational_inquiries(id) on delete cascade,
  period_start date not null,
  created_at timestamptz not null default now(),
  primary key(provider_id, inquiry_id, period_start)
);

create index if not exists training_providers_verified_idx on public.training_providers(is_verified, created_at desc);
create index if not exists vocational_courses_public_idx on public.vocational_courses(status, created_at desc);
create index if not exists vocational_courses_provider_idx on public.vocational_courses(provider_id, created_at desc);
create index if not exists vocational_courses_search_idx on public.vocational_courses using gin (to_tsvector('simple', title || ' ' || occupation));
create index if not exists vocational_inquiries_provider_idx on public.vocational_inquiries(provider_id, status, created_at desc);

alter table public.training_providers enable row level security;
alter table public.vocational_courses enable row level security;
alter table public.vocational_inquiries enable row level security;
alter table public.training_provider_contact_views enable row level security;

-- The server uses the service role only after checking the relevant signed session.
revoke all on public.training_providers, public.vocational_courses,
  public.vocational_inquiries, public.training_provider_contact_views
  from anon, authenticated;

create or replace function public.view_vocational_inquiry_contact(
  p_provider_id uuid,
  p_inquiry_id uuid,
  p_period_start date
) returns table(phone text, email text, viewed_count integer, view_limit integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_provider public.training_providers%rowtype;
  v_inquiry public.vocational_inquiries%rowtype;
  v_limit integer;
  v_count integer;
begin
  select * into v_provider from public.training_providers where id = p_provider_id for update;
  if not found then raise exception 'PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'PROVIDER_UNVERIFIED'; end if;

  if v_provider.account_type <> 'free'
     and v_provider.account_tier_expires_at is not null
     and v_provider.account_tier_expires_at <= now() then
    update public.training_providers set account_type = 'free', account_tier_expires_at = null
      where id = p_provider_id;
    v_provider.account_type := 'free';
  end if;
  v_limit := case v_provider.account_type when 'premium' then 300 when 'basic' then 60 else 0 end;

  select * into v_inquiry from public.vocational_inquiries
    where id = p_inquiry_id and provider_id = p_provider_id;
  if not found then raise exception 'INQUIRY_NOT_FOUND'; end if;

  select count(*)::integer into v_count from public.training_provider_contact_views
    where provider_id = p_provider_id and period_start = p_period_start;
  if exists (select 1 from public.training_provider_contact_views
      where provider_id = p_provider_id and inquiry_id = p_inquiry_id and period_start = p_period_start) then
    return query select v_inquiry.phone, v_inquiry.email, v_count, v_limit;
    return;
  end if;
  if v_count >= v_limit then raise exception 'CONTACT_LIMIT'; end if;

  insert into public.training_provider_contact_views(provider_id, inquiry_id, period_start)
    values (p_provider_id, p_inquiry_id, p_period_start);
  v_count := v_count + 1;
  return query select v_inquiry.phone, v_inquiry.email, v_count, v_limit;
end;
$$;

revoke all on function public.view_vocational_inquiry_contact(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.view_vocational_inquiry_contact(uuid, uuid, date) to service_role;
