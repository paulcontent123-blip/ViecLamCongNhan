alter table public.candidates
  add column if not exists avatar_url text;

comment on column public.candidates.avatar_url is
  'Public Cloudinary URL for the candidate account avatar; written only by the authenticated mobile avatar endpoint.';
