-- M6.3: rental partners, reviewed listings, rental inquiries, and guarded contact access.
-- Rental data is isolated from employers, jobs, and vocational providers.

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('candidate', 'employer', 'training_provider', 'rental_provider', 'agency', 'admin'));

create table if not exists public.rental_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider_name text not null,
  provider_slug text not null unique,
  provider_type text not null default 'individual' check (provider_type in ('individual', 'business')),
  contact_name text not null,
  contact_phone text not null,
  province_code text,
  address text,
  description text,
  is_verified boolean not null default false,
  contact_view_limit integer not null default 0 check (contact_view_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rental_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.rental_providers(id) on delete cascade,
  title text not null,
  description text not null,
  monthly_rent_vnd bigint not null check (monthly_rent_vnd >= 0),
  area_sqm numeric(8,2) check (area_sqm is null or area_sqm > 0),
  province_code text not null,
  location text not null,
  room_type text,
  capacity integer check (capacity is null or capacity > 0),
  nearby_industrial_zone text,
  amenities text[] not null default '{}',
  photo_urls text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'hidden', 'full')),
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rental_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rental_listings(id) on delete cascade,
  provider_id uuid not null references public.rental_providers(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  message text,
  contact_consent boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'resolved', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rental_provider_contact_views (
  provider_id uuid not null references public.rental_providers(id) on delete cascade,
  inquiry_id uuid not null references public.rental_inquiries(id) on delete cascade,
  period_start date not null,
  created_at timestamptz not null default now(),
  primary key(provider_id, inquiry_id, period_start)
);

create index if not exists rental_providers_verified_idx
  on public.rental_providers(is_verified, created_at desc);
create index if not exists rental_listings_public_idx
  on public.rental_listings(status, province_code, created_at desc);
create index if not exists rental_listings_provider_idx
  on public.rental_listings(provider_id, status, created_at desc);
create index if not exists rental_listings_search_idx
  on public.rental_listings using gin (to_tsvector('simple', title || ' ' || location || ' ' || coalesce(nearby_industrial_zone, '')));
create index if not exists rental_inquiries_provider_idx
  on public.rental_inquiries(provider_id, status, created_at desc);
create index if not exists rental_provider_contact_views_period_idx
  on public.rental_provider_contact_views(provider_id, period_start);

alter table public.rental_providers enable row level security;
alter table public.rental_listings enable row level security;
alter table public.rental_inquiries enable row level security;
alter table public.rental_provider_contact_views enable row level security;
revoke all on public.rental_providers, public.rental_listings, public.rental_inquiries,
  public.rental_provider_contact_views from anon, authenticated;

create or replace function public.update_rental_provider_profile_atomically(
  p_provider_id uuid,
  p_user_id uuid,
  p_provider_name text,
  p_provider_type text,
  p_contact_name text,
  p_contact_phone text,
  p_province_code text,
  p_address text,
  p_description text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_verified boolean;
  v_provider_name text;
  v_provider_type text;
begin
  select user_id, is_verified, provider_name, provider_type
    into v_user_id, v_verified, v_provider_name, v_provider_type
  from public.rental_providers where id = p_provider_id for update;

  if not found or v_user_id is distinct from p_user_id
     or not exists (select 1 from public.users where id = p_user_id and role = 'rental_provider' and status = 'active') then
    return false;
  end if;

  update public.rental_providers
  set provider_name = p_provider_name,
      provider_type = p_provider_type,
      contact_name = p_contact_name,
      contact_phone = p_contact_phone,
      province_code = p_province_code,
      address = p_address,
      description = p_description,
      is_verified = case
        when coalesce(v_verified, false) and (
          v_provider_name is distinct from p_provider_name or v_provider_type is distinct from p_provider_type
        ) then false else is_verified end,
      updated_at = now()
  where id = p_provider_id;

  update public.users set full_name = p_contact_name, phone = p_contact_phone where id = p_user_id;

  if coalesce(v_verified, false) and (
    v_provider_name is distinct from p_provider_name or v_provider_type is distinct from p_provider_type
  ) then
    update public.rental_listings
    set status = 'hidden', published_at = null,
        rejection_reason = 'Thông tin đối tác đã thay đổi; cần được Admin kiểm tra lại.', updated_at = now()
    where provider_id = p_provider_id and status = 'approved';
  end if;
  return true;
end;
$$;
revoke all on function public.update_rental_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_rental_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text)
  to service_role;

create or replace function public.guard_rental_listing_verification()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_is_verified boolean;
  v_content_changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_content_changed := old.title is distinct from new.title
      or old.description is distinct from new.description
      or old.monthly_rent_vnd is distinct from new.monthly_rent_vnd
      or old.area_sqm is distinct from new.area_sqm
      or old.province_code is distinct from new.province_code
      or old.location is distinct from new.location
      or old.room_type is distinct from new.room_type
      or old.capacity is distinct from new.capacity
      or old.nearby_industrial_zone is distinct from new.nearby_industrial_zone
      or old.amenities is distinct from new.amenities
      or old.photo_urls is distinct from new.photo_urls;
    if v_content_changed and old.status in ('approved', 'hidden', 'full', 'rejected') then
      new.status := 'pending';
      new.published_at := null;
      new.rejection_reason := null;
    end if;
  end if;

  if new.status in ('pending', 'approved') then
    select is_verified into v_is_verified from public.rental_providers where id = new.provider_id for update;
    if not found or not coalesce(v_is_verified, false) then
      raise exception using errcode = 'P0001', message = 'RENTAL_PROVIDER_UNVERIFIED';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_rental_listing_verification() from public, anon, authenticated;
grant execute on function public.guard_rental_listing_verification() to service_role;
drop trigger if exists rental_listing_provider_verification_gate on public.rental_listings;
create trigger rental_listing_provider_verification_gate
before insert or update on public.rental_listings
for each row execute function public.guard_rental_listing_verification();

create or replace function public.view_rental_inquiry_contact(
  p_provider_id uuid,
  p_inquiry_id uuid,
  p_period_start date
) returns table(phone text, email text, viewed_count integer, view_limit integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_provider public.rental_providers%rowtype;
  v_inquiry public.rental_inquiries%rowtype;
  v_count integer;
begin
  select * into v_provider from public.rental_providers where id = p_provider_id for update;
  if not found then raise exception 'RENTAL_PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'RENTAL_PROVIDER_UNVERIFIED'; end if;
  select * into v_inquiry from public.rental_inquiries
    where id = p_inquiry_id and provider_id = p_provider_id and contact_consent = true;
  if not found then raise exception 'RENTAL_INQUIRY_NOT_FOUND'; end if;

  select count(*)::integer into v_count from public.rental_provider_contact_views
    where provider_id = p_provider_id and period_start = p_period_start;
  if exists (select 1 from public.rental_provider_contact_views
      where provider_id = p_provider_id and inquiry_id = p_inquiry_id and period_start = p_period_start) then
    return query select v_inquiry.phone, v_inquiry.email, v_count, v_provider.contact_view_limit;
    return;
  end if;
  if v_count >= v_provider.contact_view_limit then raise exception 'RENTAL_CONTACT_LIMIT'; end if;

  insert into public.rental_provider_contact_views(provider_id, inquiry_id, period_start)
    values (p_provider_id, p_inquiry_id, p_period_start);
  return query select v_inquiry.phone, v_inquiry.email, v_count + 1, v_provider.contact_view_limit;
end;
$$;
revoke all on function public.view_rental_inquiry_contact(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.view_rental_inquiry_contact(uuid, uuid, date) to service_role;
