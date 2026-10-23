-- M6.6 Health partner MVP: verified health facilities, reviewed services and
-- consented appointment/consultation requests. No diagnosis or medical history.

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('candidate', 'employer', 'training_provider', 'rental_provider', 'insurance_provider', 'finance_provider', 'health_provider', 'agency', 'admin'));

create table if not exists public.health_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider_name text not null,
  provider_slug text not null unique,
  provider_type text not null default 'clinic'
    check (provider_type in ('hospital', 'clinic', 'medical_center')),
  contact_name text not null,
  contact_phone text not null,
  province_code text,
  address text,
  tax_code text,
  license_number text,
  license_evidence_url text,
  description text,
  logo_url text,
  is_verified boolean not null default false,
  contact_view_limit integer not null default 0 check (contact_view_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.health_providers(id) on delete restrict,
  category text not null check (category in ('consultation', 'examination', 'screening')),
  title text not null,
  specialty text,
  description text not null,
  price_label text,
  address text,
  province_code text,
  opening_hours text,
  accepts_bhyt boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'hidden')),
  rejection_reason text,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_inquiries (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.health_services(id) on delete restrict,
  provider_id uuid not null references public.health_providers(id) on delete restrict,
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  desired_date date,
  preferred_time text,
  contact_consent boolean not null check (contact_consent = true),
  consent_text text not null,
  consented_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'appointment_confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_provider_contact_views (
  provider_id uuid not null references public.health_providers(id) on delete cascade,
  inquiry_id uuid not null references public.health_inquiries(id) on delete cascade,
  period_start date not null,
  created_at timestamptz not null default now(),
  primary key (provider_id, inquiry_id, period_start)
);

create index if not exists health_providers_verified_idx on public.health_providers(is_verified, created_at desc);
create index if not exists health_services_public_idx on public.health_services(status, province_code, created_at desc) where archived_at is null;
create index if not exists health_services_provider_idx on public.health_services(provider_id, status, created_at desc) where archived_at is null;
create index if not exists health_inquiries_provider_idx on public.health_inquiries(provider_id, status, created_at desc);
create index if not exists health_provider_contact_views_period_idx on public.health_provider_contact_views(provider_id, period_start);

alter table public.health_providers enable row level security;
alter table public.health_services enable row level security;
alter table public.health_inquiries enable row level security;
alter table public.health_provider_contact_views enable row level security;
revoke all on public.health_providers, public.health_services, public.health_inquiries, public.health_provider_contact_views from anon, authenticated;
grant all on public.health_providers, public.health_services, public.health_inquiries, public.health_provider_contact_views to service_role;

create or replace function public.update_health_provider_profile_atomically(
  p_provider_id uuid, p_user_id uuid, p_provider_name text, p_provider_type text,
  p_contact_name text, p_contact_phone text, p_province_code text, p_address text,
  p_tax_code text, p_license_number text, p_license_evidence_url text, p_description text
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_provider public.health_providers%rowtype;
  v_identity_changed boolean;
begin
  select * into v_provider from public.health_providers where id = p_provider_id for update;
  if not found or v_provider.user_id is distinct from p_user_id or not exists (
    select 1 from public.users where id = p_user_id and role = 'health_provider' and status = 'active'
  ) then return false; end if;

  v_identity_changed := v_provider.provider_name is distinct from p_provider_name
    or v_provider.provider_type is distinct from p_provider_type
    or v_provider.tax_code is distinct from p_tax_code
    or v_provider.license_number is distinct from p_license_number
    or v_provider.license_evidence_url is distinct from p_license_evidence_url;

  update public.health_providers set
    provider_name = p_provider_name,
    provider_type = p_provider_type,
    contact_name = p_contact_name,
    contact_phone = p_contact_phone,
    province_code = p_province_code,
    address = p_address,
    tax_code = p_tax_code,
    license_number = p_license_number,
    license_evidence_url = p_license_evidence_url,
    description = p_description,
    is_verified = case when v_identity_changed then false else is_verified end,
    updated_at = now()
  where id = p_provider_id;

  update public.users set full_name = p_contact_name, phone = p_contact_phone where id = p_user_id;
  return true;
end; $$;
revoke all on function public.update_health_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_health_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text, text, text, text) to service_role;

create or replace function public.guard_health_provider_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_verified and (
    nullif(trim(new.license_number), '') is null
    or nullif(trim(new.license_evidence_url), '') is null
    or trim(new.license_evidence_url) not like 'https://%'
  ) then raise exception 'HEALTH_PROVIDER_LICENSE_REQUIRED'; end if;
  return new;
end; $$;
revoke all on function public.guard_health_provider_verification() from public, anon, authenticated;
grant execute on function public.guard_health_provider_verification() to service_role;
drop trigger if exists health_provider_verification_gate on public.health_providers;
create trigger health_provider_verification_gate before insert or update of is_verified on public.health_providers
for each row execute function public.guard_health_provider_verification();

create or replace function public.reset_health_services_after_provider_unverify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_verified and not new.is_verified then
    update public.health_services set status = 'draft', rejection_reason = null,
      published_at = null, updated_at = now()
    where provider_id = new.id and status in ('pending', 'approved');
  end if;
  return new;
end; $$;
revoke all on function public.reset_health_services_after_provider_unverify() from public, anon, authenticated;
grant execute on function public.reset_health_services_after_provider_unverify() to service_role;
drop trigger if exists health_provider_unverify_reset_services on public.health_providers;
create trigger health_provider_unverify_reset_services after update of is_verified on public.health_providers
for each row execute function public.reset_health_services_after_provider_unverify();

create or replace function public.guard_health_service_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_provider public.health_providers%rowtype;
begin
  select * into v_provider from public.health_providers where id = new.provider_id;
  if new.status in ('pending', 'approved') and not coalesce(v_provider.is_verified, false) then
    raise exception 'HEALTH_PROVIDER_UNVERIFIED';
  end if;
  if tg_op = 'UPDATE' and old.status = 'approved' and new.status = 'approved' and (
    old.category is distinct from new.category or old.title is distinct from new.title
    or old.specialty is distinct from new.specialty or old.description is distinct from new.description
    or old.price_label is distinct from new.price_label or old.address is distinct from new.address
    or old.province_code is distinct from new.province_code or old.opening_hours is distinct from new.opening_hours
    or old.accepts_bhyt is distinct from new.accepts_bhyt
  ) then
    new.status := 'pending'; new.published_at := null; new.rejection_reason := null;
  end if;
  if new.status = 'approved' and (
    nullif(trim(v_provider.license_number), '') is null
    or nullif(trim(v_provider.license_evidence_url), '') is null
    or trim(v_provider.license_evidence_url) not like 'https://%'
  ) then raise exception 'HEALTH_PROVIDER_LICENSE_REQUIRED'; end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.published_at := now();
  end if;
  return new;
end; $$;
revoke all on function public.guard_health_service_review() from public, anon, authenticated;
grant execute on function public.guard_health_service_review() to service_role;
drop trigger if exists health_service_review_gate on public.health_services;
create trigger health_service_review_gate before insert or update of status, provider_id, category, title, specialty,
description, price_label, address, province_code, opening_hours, accepts_bhyt on public.health_services
for each row execute function public.guard_health_service_review();

create or replace function public.view_health_inquiry_contact(p_provider_id uuid, p_inquiry_id uuid)
returns table(full_name text, phone text, viewed_count integer, view_limit integer)
language plpgsql security definer set search_path = public as $$
declare
  v_provider public.health_providers%rowtype;
  v_inquiry public.health_inquiries%rowtype;
  v_period_start date := date_trunc('month', timezone('Asia/Ho_Chi_Minh', now()))::date;
  v_count integer;
begin
  select * into v_provider from public.health_providers where id = p_provider_id for update;
  if not found then raise exception 'HEALTH_PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'HEALTH_PROVIDER_UNVERIFIED'; end if;
  select * into v_inquiry from public.health_inquiries
    where id = p_inquiry_id and provider_id = p_provider_id and contact_consent = true;
  if not found then raise exception 'HEALTH_INQUIRY_NOT_AVAILABLE'; end if;
  select count(*)::integer into v_count from public.health_provider_contact_views
    where provider_id = p_provider_id and period_start = v_period_start;
  if exists (select 1 from public.health_provider_contact_views
    where provider_id = p_provider_id and inquiry_id = p_inquiry_id and period_start = v_period_start) then
    return query select v_inquiry.full_name, v_inquiry.phone, v_count, v_provider.contact_view_limit; return;
  end if;
  if v_count >= v_provider.contact_view_limit then raise exception 'HEALTH_CONTACT_LIMIT'; end if;
  insert into public.health_provider_contact_views(provider_id, inquiry_id, period_start)
    values (p_provider_id, p_inquiry_id, v_period_start);
  return query select v_inquiry.full_name, v_inquiry.phone, v_count + 1, v_provider.contact_view_limit;
end; $$;
revoke all on function public.view_health_inquiry_contact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.view_health_inquiry_contact(uuid, uuid) to service_role;

comment on column public.health_providers.contact_view_limit is 'Admin-assigned monthly quota for consented health inquiry contact views; defaults to zero.';
comment on table public.health_inquiries is 'Consent-based contact/appointment requests only; never store diagnosis, symptoms, medical records, or treatment notes.';
