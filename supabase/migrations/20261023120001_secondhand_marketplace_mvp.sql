-- Mobile-first second-hand marketplace. This migration adds data/API support only;
-- no web UI is introduced.
create table if not exists public.secondhand_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references public.users(id) on delete restrict,
  seller_display_name text not null,
  title text not null check (char_length(trim(title)) between 5 and 140),
  description text not null check (char_length(trim(description)) between 20 and 5000),
  category text not null check (category in ('vehicle', 'home_goods', 'electronics', 'clothing', 'other')),
  item_condition text not null check (item_condition in ('new', 'like_new', 'good', 'fair')),
  price_vnd bigint not null check (price_vnd >= 0),
  is_negotiable boolean not null default false,
  province_code text,
  location text not null check (char_length(trim(location)) between 2 and 200),
  photo_urls text[] not null default '{}',
  seller_state text not null default 'available' check (seller_state in ('available', 'sold', 'hidden')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint secondhand_marketplace_approved_requires_photo
    check (moderation_status <> 'approved' or cardinality(photo_urls) > 0)
);

create index if not exists secondhand_marketplace_public_idx
  on public.secondhand_marketplace_listings(province_code, category, expires_at, created_at desc)
  where moderation_status = 'approved' and seller_state = 'available';
create index if not exists secondhand_marketplace_seller_idx
  on public.secondhand_marketplace_listings(seller_user_id, created_at desc);
create index if not exists secondhand_marketplace_review_idx
  on public.secondhand_marketplace_listings(moderation_status, created_at desc);

create table if not exists public.secondhand_marketplace_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.secondhand_marketplace_listings(id) on delete restrict,
  seller_user_id uuid not null references public.users(id) on delete restrict,
  buyer_user_id uuid not null references public.users(id) on delete restrict,
  message text,
  contact_consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_user_id <> buyer_user_id)
);

create index if not exists secondhand_marketplace_inquiries_seller_idx
  on public.secondhand_marketplace_inquiries(seller_user_id, status, created_at desc);
create index if not exists secondhand_marketplace_inquiries_buyer_idx
  on public.secondhand_marketplace_inquiries(buyer_user_id, created_at desc);

alter table public.secondhand_marketplace_listings enable row level security;
alter table public.secondhand_marketplace_inquiries enable row level security;
revoke all on public.secondhand_marketplace_listings, public.secondhand_marketplace_inquiries
  from public, anon, authenticated;
grant all on public.secondhand_marketplace_listings, public.secondhand_marketplace_inquiries to service_role;

-- Photos are added one at a time after Cloudinary validates and uploads them.
-- Removing/reordering is optimistic and can only retain photos already owned by the row.
create or replace function public.append_secondhand_marketplace_photo(
  p_listing_id uuid, p_seller_user_id uuid, p_photo_url text
) returns text[]
language plpgsql security definer set search_path = public
as $$
declare
  v_listing public.secondhand_marketplace_listings%rowtype;
  v_photo_urls text[];
begin
  select * into v_listing from public.secondhand_marketplace_listings
    where id = p_listing_id and seller_user_id = p_seller_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'MARKETPLACE_LISTING_NOT_FOUND'; end if;
  if v_listing.expires_at is not null and v_listing.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'MARKETPLACE_LISTING_EXPIRED';
  end if;
  if p_photo_url is null or p_photo_url !~ '^https://' then
    raise exception using errcode = '22023', message = 'MARKETPLACE_PHOTO_URL_INVALID';
  end if;
  if p_photo_url = any(v_listing.photo_urls) then return v_listing.photo_urls; end if;
  if cardinality(v_listing.photo_urls) >= 8 then
    raise exception using errcode = 'P0001', message = 'MARKETPLACE_PHOTO_LIMIT';
  end if;
  update public.secondhand_marketplace_listings
    set photo_urls = array_append(photo_urls, p_photo_url),
        moderation_status = 'pending', rejection_reason = null,
        published_at = null, expires_at = null, updated_at = now()
    where id = p_listing_id and seller_user_id = p_seller_user_id
    returning photo_urls into v_photo_urls;
  return v_photo_urls;
end;
$$;

create or replace function public.set_secondhand_marketplace_photos(
  p_listing_id uuid, p_seller_user_id uuid, p_expected_photo_urls text[], p_next_photo_urls text[]
) returns text[]
language plpgsql security definer set search_path = public
as $$
declare
  v_listing public.secondhand_marketplace_listings%rowtype;
  v_url text;
  v_photo_urls text[];
begin
  select * into v_listing from public.secondhand_marketplace_listings
    where id = p_listing_id and seller_user_id = p_seller_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'MARKETPLACE_LISTING_NOT_FOUND'; end if;
  if v_listing.expires_at is not null and v_listing.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'MARKETPLACE_LISTING_EXPIRED';
  end if;
  if v_listing.photo_urls is distinct from p_expected_photo_urls then
    raise exception using errcode = '40001', message = 'MARKETPLACE_PHOTOS_CONFLICT';
  end if;
  if p_next_photo_urls is null or cardinality(p_next_photo_urls) > 8 then
    raise exception using errcode = '22023', message = 'MARKETPLACE_PHOTO_LIMIT';
  end if;
  if cardinality(p_next_photo_urls) <> (select count(distinct value) from unnest(p_next_photo_urls) as urls(value)) then
    raise exception using errcode = '22023', message = 'MARKETPLACE_PHOTOS_DUPLICATED';
  end if;
  foreach v_url in array p_next_photo_urls loop
    if not (v_url = any(v_listing.photo_urls)) then
      raise exception using errcode = '22023', message = 'MARKETPLACE_PHOTO_NOT_OWNED';
    end if;
  end loop;
  update public.secondhand_marketplace_listings
    set photo_urls = p_next_photo_urls,
        moderation_status = 'pending', rejection_reason = null,
        published_at = null, expires_at = null, updated_at = now()
    where id = p_listing_id and seller_user_id = p_seller_user_id
    returning photo_urls into v_photo_urls;
  return v_photo_urls;
end;
$$;

revoke all on function public.append_secondhand_marketplace_photo(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.set_secondhand_marketplace_photos(uuid, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function public.append_secondhand_marketplace_photo(uuid, uuid, text) to service_role;
grant execute on function public.set_secondhand_marketplace_photos(uuid, uuid, text[], text[]) to service_role;
