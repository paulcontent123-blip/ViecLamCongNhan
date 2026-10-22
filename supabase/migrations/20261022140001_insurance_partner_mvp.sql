-- M6.4: verified insurance partners, reviewed informational offers, and consented inquiries.
-- The app does not sell policies, collect premiums, or issue coverage.

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('candidate', 'employer', 'training_provider', 'rental_provider', 'insurance_provider', 'agency', 'admin'));

create table if not exists public.insurance_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider_name text not null,
  provider_slug text not null unique,
  provider_type text not null default 'insurance_company'
    check (provider_type in ('insurance_company', 'licensed_agent', 'public_program')),
  contact_name text not null,
  contact_phone text not null,
  province_code text,
  tax_code text,
  license_number text,
  description text,
  logo_url text,
  is_verified boolean not null default false,
  contact_view_limit integer not null default 0 check (contact_view_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insurance_products (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.insurance_providers(id) on delete cascade,
  category text not null check (category in ('bhxh_voluntary', 'bhyt', 'accident', 'health', 'other')),
  title text not null,
  subtitle text,
  description text not null,
  price_label text,
  benefits_summary text,
  eligibility_text text,
  exclusions_text text,
  terms_url text,
  updated_terms_at date,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'hidden')),
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insurance_inquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.insurance_products(id) on delete restrict,
  provider_id uuid not null references public.insurance_providers(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  message text,
  contact_consent boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'advising', 'resolved', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insurance_provider_contact_views (
  provider_id uuid not null references public.insurance_providers(id) on delete cascade,
  inquiry_id uuid not null references public.insurance_inquiries(id) on delete cascade,
  period_start date not null,
  created_at timestamptz not null default now(),
  primary key(provider_id, inquiry_id, period_start)
);

create index if not exists insurance_providers_verified_idx
  on public.insurance_providers(is_verified, created_at desc);
create index if not exists insurance_products_public_idx
  on public.insurance_products(status, category, created_at desc);
create index if not exists insurance_products_provider_idx
  on public.insurance_products(provider_id, status, created_at desc);
create index if not exists insurance_inquiries_provider_idx
  on public.insurance_inquiries(provider_id, status, created_at desc);
create index if not exists insurance_provider_contact_views_period_idx
  on public.insurance_provider_contact_views(provider_id, period_start);

alter table public.insurance_providers enable row level security;
alter table public.insurance_products enable row level security;
alter table public.insurance_inquiries enable row level security;
alter table public.insurance_provider_contact_views enable row level security;
revoke all on public.insurance_providers, public.insurance_products,
  public.insurance_inquiries, public.insurance_provider_contact_views
  from anon, authenticated;
grant all on public.insurance_providers, public.insurance_products,
  public.insurance_inquiries, public.insurance_provider_contact_views to service_role;

create or replace function public.update_insurance_provider_profile_atomically(
  p_provider_id uuid,
  p_user_id uuid,
  p_provider_name text,
  p_provider_type text,
  p_contact_name text,
  p_contact_phone text,
  p_province_code text,
  p_tax_code text,
  p_license_number text,
  p_description text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_provider public.insurance_providers%rowtype;
  v_identity_changed boolean;
begin
  select * into v_provider from public.insurance_providers
    where id = p_provider_id for update;
  if not found or v_provider.user_id is distinct from p_user_id
     or not exists (select 1 from public.users where id = p_user_id and role = 'insurance_provider' and status = 'active') then
    return false;
  end if;
  v_identity_changed := v_provider.provider_name is distinct from p_provider_name
    or v_provider.provider_type is distinct from p_provider_type
    or v_provider.tax_code is distinct from p_tax_code
    or v_provider.license_number is distinct from p_license_number;
  update public.insurance_providers set
    provider_name = p_provider_name,
    provider_type = p_provider_type,
    contact_name = p_contact_name,
    contact_phone = p_contact_phone,
    province_code = p_province_code,
    tax_code = p_tax_code,
    license_number = p_license_number,
    description = p_description,
    is_verified = case when v_identity_changed then false else is_verified end,
    updated_at = now()
  where id = p_provider_id;
  update public.users set full_name = p_contact_name, phone = p_contact_phone where id = p_user_id;
  return true;
end;
$$;
revoke all on function public.update_insurance_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_insurance_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text, text)
  to service_role;

create or replace function public.guard_insurance_product_verification()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('pending', 'approved') and not exists (
    select 1 from public.insurance_providers
    where id = new.provider_id and is_verified = true
  ) then
    raise exception 'INSURANCE_PROVIDER_UNVERIFIED';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_insurance_product_verification() from public, anon, authenticated;
grant execute on function public.guard_insurance_product_verification() to service_role;
drop trigger if exists insurance_products_verification_gate on public.insurance_products;
create trigger insurance_products_verification_gate
before insert or update of status, provider_id on public.insurance_products
for each row execute function public.guard_insurance_product_verification();

create or replace function public.view_insurance_inquiry_contact(
  p_provider_id uuid,
  p_inquiry_id uuid,
  p_period_start date
) returns table(phone text, email text, viewed_count integer, view_limit integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_provider public.insurance_providers%rowtype;
  v_inquiry public.insurance_inquiries%rowtype;
  v_count integer;
begin
  select * into v_provider from public.insurance_providers where id = p_provider_id for update;
  if not found then raise exception 'PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'PROVIDER_UNVERIFIED'; end if;
  select * into v_inquiry from public.insurance_inquiries
    where id = p_inquiry_id and provider_id = p_provider_id;
  if not found then raise exception 'INQUIRY_NOT_FOUND'; end if;
  if not v_inquiry.contact_consent then raise exception 'CONTACT_NOT_CONSENTED'; end if;
  select count(*)::integer into v_count from public.insurance_provider_contact_views
    where provider_id = p_provider_id and period_start = p_period_start;
  if exists (select 1 from public.insurance_provider_contact_views
      where provider_id = p_provider_id and inquiry_id = p_inquiry_id and period_start = p_period_start) then
    return query select v_inquiry.phone, v_inquiry.email, v_count, v_provider.contact_view_limit;
    return;
  end if;
  if v_count >= v_provider.contact_view_limit then raise exception 'CONTACT_LIMIT'; end if;
  insert into public.insurance_provider_contact_views(provider_id, inquiry_id, period_start)
    values (p_provider_id, p_inquiry_id, p_period_start);
  v_count := v_count + 1;
  return query select v_inquiry.phone, v_inquiry.email, v_count, v_provider.contact_view_limit;
end;
$$;
revoke all on function public.view_insurance_inquiry_contact(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.view_insurance_inquiry_contact(uuid, uuid, date) to service_role;
