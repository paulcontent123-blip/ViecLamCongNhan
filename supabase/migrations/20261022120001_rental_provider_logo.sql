-- Store a public-facing logo for each rental partner profile.
alter table public.rental_providers
  add column if not exists logo_url text;
