-- Atomic, owner-scoped photo list updates used by the authenticated mobile API.
-- The HTTP route derives provider_id from the rental-provider session and only
-- accepts newly uploaded Cloudinary URLs in the listing-specific folder.

create or replace function public.append_rental_listing_photo(
  p_listing_id uuid,
  p_provider_id uuid,
  p_photo_url text
) returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.rental_listings%rowtype;
  v_photo_urls text[];
begin
  select * into v_listing
    from public.rental_listings
    where id = p_listing_id and provider_id = p_provider_id
    for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RENTAL_LISTING_NOT_FOUND';
  end if;

  if p_photo_url is null or p_photo_url !~ '^https://' then
    raise exception using errcode = '22023', message = 'RENTAL_LISTING_PHOTO_URL_INVALID';
  end if;

  if p_photo_url = any(v_listing.photo_urls) then
    return v_listing.photo_urls;
  end if;

  if cardinality(v_listing.photo_urls) >= 12 then
    raise exception using errcode = 'P0001', message = 'RENTAL_LISTING_PHOTO_LIMIT';
  end if;

  update public.rental_listings
    set photo_urls = array_append(v_listing.photo_urls, p_photo_url), updated_at = now()
    where id = p_listing_id and provider_id = p_provider_id
    returning photo_urls into v_photo_urls;

  return v_photo_urls;
end;
$$;

create or replace function public.set_rental_listing_photos(
  p_listing_id uuid,
  p_provider_id uuid,
  p_expected_photo_urls text[],
  p_next_photo_urls text[]
) returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.rental_listings%rowtype;
  v_photo_urls text[];
  v_url text;
begin
  select * into v_listing
    from public.rental_listings
    where id = p_listing_id and provider_id = p_provider_id
    for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RENTAL_LISTING_NOT_FOUND';
  end if;

  if v_listing.photo_urls is distinct from p_expected_photo_urls then
    raise exception using errcode = '40001', message = 'RENTAL_LISTING_PHOTOS_CONFLICT';
  end if;

  if p_next_photo_urls is null or cardinality(p_next_photo_urls) > 12 then
    raise exception using errcode = '22023', message = 'RENTAL_LISTING_PHOTO_LIMIT';
  end if;

  if cardinality(p_next_photo_urls) <> (select count(distinct value) from unnest(p_next_photo_urls) as photo_urls(value)) then
    raise exception using errcode = '22023', message = 'RENTAL_LISTING_PHOTOS_DUPLICATED';
  end if;

  foreach v_url in array p_next_photo_urls loop
    if not (v_url = any(v_listing.photo_urls)) then
      raise exception using errcode = '22023', message = 'RENTAL_LISTING_PHOTO_NOT_OWNED';
    end if;
  end loop;

  update public.rental_listings
    set photo_urls = p_next_photo_urls, updated_at = now()
    where id = p_listing_id and provider_id = p_provider_id
    returning photo_urls into v_photo_urls;

  return v_photo_urls;
end;
$$;

revoke all on function public.append_rental_listing_photo(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.set_rental_listing_photos(uuid, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function public.append_rental_listing_photo(uuid, uuid, text) to service_role;
grant execute on function public.set_rental_listing_photos(uuid, uuid, text[], text[]) to service_role;
