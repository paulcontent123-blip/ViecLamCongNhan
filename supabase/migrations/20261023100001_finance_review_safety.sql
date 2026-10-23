-- Finance partner safety: private license evidence, re-review after legal identity changes,
-- verified-provider license gate, optimistic review and soft-archived products.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-license-evidence',
  'finance-license-evidence',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.finance_products
  add column if not exists archived_at timestamptz;

create index if not exists finance_products_active_provider_idx
  on public.finance_products(provider_id, status, created_at desc)
  where archived_at is null;

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

  update public.finance_providers set
    provider_name = p_provider_name,
    provider_type = p_provider_type,
    contact_name = p_contact_name,
    contact_phone = p_contact_phone,
    province_code = p_province_code,
    tax_code = p_tax_code,
    license_number = p_license_number,
    license_evidence_url = p_license_evidence_url,
    description = p_description,
    is_verified = case when v_identity_changed then false else is_verified end,
    updated_at = now()
  where id = p_provider_id;

  if v_identity_changed then
    update public.finance_products set
      status = 'draft',
      rejection_reason = null,
      published_at = null,
      pricing_approved = false,
      pricing_reviewed_at = null,
      pricing_reviewed_by = null,
      updated_at = now()
    where provider_id = p_provider_id;
  end if;

  update public.users set full_name = p_contact_name, phone = p_contact_phone where id = p_user_id;
  return true;
end; $$;

create or replace function public.guard_finance_provider_verification_license()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_verified and (
    nullif(trim(new.license_number), '') is null
    or nullif(trim(new.license_evidence_url), '') is null
  ) then
    raise exception 'FINANCE_PROVIDER_LICENSE_REQUIRED';
  end if;
  return new;
end; $$;

revoke all on function public.guard_finance_provider_verification_license() from public, anon, authenticated;
grant execute on function public.guard_finance_provider_verification_license() to service_role;
drop trigger if exists finance_provider_verification_license_gate on public.finance_providers;
create trigger finance_provider_verification_license_gate
before insert or update of is_verified on public.finance_providers
for each row execute function public.guard_finance_provider_verification_license();

comment on column public.finance_products.archived_at is
  'Soft archive timestamp. Archived products remain available for inquiry history and are excluded from provider/public catalog lists.';
comment on column public.finance_providers.license_evidence_url is
  'HTTPS evidence URL or private-storage:<object-path> reference in finance-license-evidence.';
