alter table public.secondhand_marketplace_listings
  add column if not exists seller_contact_consent_at timestamptz,
  add column if not exists seller_contact_consent_phone_hash text;

comment on column public.secondhand_marketplace_listings.seller_contact_consent_at is
  'Timestamp when the seller explicitly consented to share their verified account phone with buyers who submitted a contact inquiry.';
comment on column public.secondhand_marketplace_listings.seller_contact_consent_phone_hash is
  'SHA-256 hash of the verified phone covered by seller consent; prevents consent from carrying over after the account phone changes.';
