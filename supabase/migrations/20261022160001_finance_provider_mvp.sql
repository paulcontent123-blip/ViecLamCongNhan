-- M6.5 Finance provider MVP: verified product information and consented inquiries.
-- The app collects consultation requests only; it does not originate loans or transfer money.

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('candidate', 'employer', 'training_provider', 'rental_provider', 'insurance_provider', 'finance_provider', 'agency', 'admin'));

create table if not exists public.finance_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider_name text not null,
  provider_slug text not null unique,
  provider_type text not null default 'finance_company'
    check (provider_type in ('bank', 'finance_company', 'remittance_provider', 'other')),
  contact_name text not null,
  contact_phone text not null,
  province_code text,
  tax_code text,
  license_number text,
  license_evidence_url text,
  description text,
  logo_url text,
  is_verified boolean not null default false,
  contact_view_limit integer not null default 0 check (contact_view_limit >= 0),
  account_type text not null default 'free' check (account_type in ('free', 'basic', 'premium')),
  account_tier_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_products (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.finance_providers(id) on delete cascade,
  category text not null check (category in ('ewa', 'consumer_loan', 'remittance')),
  title text not null,
  subtitle text,
  description text not null,
  price_label text,
  benefits_summary text,
  eligibility_text text,
  exclusions_text text,
  terms_url text,
  updated_terms_at date,
  pricing_source_url text,
  pricing_effective_at date,
  pricing_approved boolean not null default false,
  pricing_reviewed_at timestamptz,
  pricing_reviewed_by uuid references public.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'hidden')),
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_inquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.finance_products(id) on delete restrict,
  provider_id uuid not null references public.finance_providers(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  category text not null check (category in ('ewa', 'consumer_loan', 'remittance')),
  inquiry_topic text not null,
  full_name text not null,
  phone text not null,
  email text,
  province_code text,
  destination_province_code text,
  message text,
  contact_consent boolean not null default false check (contact_consent = true),
  consent_text text not null,
  consented_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'advising', 'resolved', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_provider_contact_views (
  provider_id uuid not null references public.finance_providers(id) on delete cascade,
  inquiry_id uuid not null references public.finance_inquiries(id) on delete cascade,
  period_start date not null,
  created_at timestamptz not null default now(),
  primary key (provider_id, inquiry_id, period_start)
);

alter table public.orders
  add column if not exists finance_provider_id uuid references public.finance_providers(id) on delete restrict;
create index if not exists orders_finance_provider_id_idx on public.orders(finance_provider_id, created_at desc);
alter table public.orders drop constraint if exists orders_single_owner_check;
alter table public.orders add constraint orders_single_owner_check check (
  (employer_id is not null)::integer + (training_provider_id is not null)::integer
  + (rental_provider_id is not null)::integer + (insurance_provider_id is not null)::integer
  + (finance_provider_id is not null)::integer = 1
) not valid;

create index if not exists finance_providers_verified_idx on public.finance_providers(is_verified, created_at desc);
create index if not exists finance_products_public_idx on public.finance_products(status, category, created_at desc);
create index if not exists finance_products_provider_idx on public.finance_products(provider_id, status, created_at desc);
create index if not exists finance_inquiries_provider_idx on public.finance_inquiries(provider_id, status, created_at desc);
create index if not exists finance_provider_contact_views_period_idx on public.finance_provider_contact_views(provider_id, period_start);

alter table public.finance_providers enable row level security;
alter table public.finance_products enable row level security;
alter table public.finance_inquiries enable row level security;
alter table public.finance_provider_contact_views enable row level security;
revoke all on public.finance_providers, public.finance_products, public.finance_inquiries, public.finance_provider_contact_views from anon, authenticated;
grant all on public.finance_providers, public.finance_products, public.finance_inquiries, public.finance_provider_contact_views to service_role;

create or replace function public.update_finance_provider_profile_atomically(
  p_provider_id uuid, p_user_id uuid, p_provider_name text, p_provider_type text,
  p_contact_name text, p_contact_phone text, p_province_code text,
  p_tax_code text, p_license_number text, p_license_evidence_url text, p_description text
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_provider public.finance_providers%rowtype;
  v_identity_changed boolean;
begin
  select * into v_provider from public.finance_providers where id = p_provider_id for update;
  if not found or v_provider.user_id is distinct from p_user_id or not exists (
    select 1 from public.users where id = p_user_id and role = 'finance_provider' and status = 'active'
  ) then return false; end if;
  v_identity_changed := v_provider.provider_name is distinct from p_provider_name
    or v_provider.provider_type is distinct from p_provider_type
    or v_provider.tax_code is distinct from p_tax_code
    or v_provider.license_number is distinct from p_license_number
    or v_provider.license_evidence_url is distinct from p_license_evidence_url;
  update public.finance_providers set provider_name = p_provider_name, provider_type = p_provider_type,
    contact_name = p_contact_name, contact_phone = p_contact_phone, province_code = p_province_code,
    tax_code = p_tax_code, license_number = p_license_number, license_evidence_url = p_license_evidence_url,
    description = p_description, is_verified = case when v_identity_changed then false else is_verified end,
    updated_at = now() where id = p_provider_id;
  update public.users set full_name = p_contact_name, phone = p_contact_phone where id = p_user_id;
  return true;
end; $$;
revoke all on function public.update_finance_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_finance_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text, text, text) to service_role;

create or replace function public.guard_finance_product_verification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_provider public.finance_providers%rowtype;
begin
  select * into v_provider from public.finance_providers where id = new.provider_id;
  if new.status in ('pending', 'approved') and not coalesce(v_provider.is_verified, false) then
    raise exception 'FINANCE_PROVIDER_UNVERIFIED';
  end if;
  if tg_op = 'UPDATE' and (
    old.price_label is distinct from new.price_label
    or old.pricing_source_url is distinct from new.pricing_source_url
    or old.pricing_effective_at is distinct from new.pricing_effective_at
  ) then
    new.pricing_approved := false;
    new.pricing_reviewed_at := null;
    new.pricing_reviewed_by := null;
    if old.status = 'approved' and new.status = 'approved' then
      new.status := 'pending';
      new.published_at := null;
    end if;
  end if;
  if new.status = 'approved' and (
    not coalesce(new.pricing_approved, false)
    or nullif(trim(v_provider.license_number), '') is null
    or nullif(trim(v_provider.license_evidence_url), '') is null
    or nullif(trim(new.price_label), '') is null
    or nullif(trim(new.pricing_source_url), '') is null
    or new.pricing_effective_at is null
  ) then raise exception 'FINANCE_PRICING_REVIEW_REQUIRED'; end if;
  return new;
end; $$;
revoke all on function public.guard_finance_product_verification() from public, anon, authenticated;
grant execute on function public.guard_finance_product_verification() to service_role;
drop trigger if exists finance_products_verification_gate on public.finance_products;
create trigger finance_products_verification_gate before insert or update of status, provider_id, pricing_approved, price_label, pricing_source_url, pricing_effective_at
on public.finance_products for each row execute function public.guard_finance_product_verification();

create or replace function public.view_finance_inquiry_contact(p_provider_id uuid, p_inquiry_id uuid, p_period_start date)
returns table(phone text, email text, viewed_count integer, view_limit integer)
language plpgsql security definer set search_path = public as $$
declare
  v_provider public.finance_providers%rowtype;
  v_inquiry public.finance_inquiries%rowtype;
  v_count integer;
  v_limit integer;
begin
  select * into v_provider from public.finance_providers where id = p_provider_id for update;
  if not found then raise exception 'PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'PROVIDER_UNVERIFIED'; end if;
  if v_provider.account_type <> 'free' and v_provider.account_tier_expires_at is not null and v_provider.account_tier_expires_at <= now() then
    update public.finance_providers set account_type = 'free', account_tier_expires_at = null where id = p_provider_id;
    v_provider.account_type := 'free'; v_provider.account_tier_expires_at := null;
  end if;
  v_limit := case v_provider.account_type when 'premium' then 300 when 'basic' then 60 else 0 end;
  if v_provider.contact_view_limit > 0 then v_limit := v_provider.contact_view_limit; end if;
  select * into v_inquiry from public.finance_inquiries where id = p_inquiry_id and provider_id = p_provider_id and contact_consent = true;
  if not found then raise exception 'INQUIRY_NOT_AVAILABLE'; end if;
  select count(*)::integer into v_count from public.finance_provider_contact_views where provider_id = p_provider_id and period_start = p_period_start;
  if exists (select 1 from public.finance_provider_contact_views where provider_id = p_provider_id and inquiry_id = p_inquiry_id and period_start = p_period_start) then
    return query select v_inquiry.phone, v_inquiry.email, v_count, v_limit; return;
  end if;
  if v_count >= v_limit then raise exception 'CONTACT_LIMIT'; end if;
  insert into public.finance_provider_contact_views(provider_id, inquiry_id, period_start) values (p_provider_id, p_inquiry_id, p_period_start);
  return query select v_inquiry.phone, v_inquiry.email, v_count + 1, v_limit;
end; $$;
revoke all on function public.view_finance_inquiry_contact(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.view_finance_inquiry_contact(uuid, uuid, date) to service_role;

comment on column public.finance_products.pricing_approved is 'Only Admin-reviewed pricing source and effective date may be exposed on public product cards.';
comment on column public.finance_providers.contact_view_limit is 'Positive Admin override; otherwise Free 0, Basic 60, Premium 300 monthly inquiry contact views.';
