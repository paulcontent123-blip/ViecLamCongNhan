-- Mobile-only profile editing for training providers.
-- Existing web APIs and the public provider slug are intentionally unchanged.
create or replace function public.update_training_provider_profile_atomically(
  p_provider_id uuid,
  p_user_id uuid,
  p_provider_name text,
  p_contact_name text,
  p_contact_phone text,
  p_tax_code text,
  p_province_code text,
  p_license_number text,
  p_description text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_verified boolean;
  v_updated integer;
begin
  select user_id, is_verified into v_user_id, v_verified
  from public.training_providers
  where id = p_provider_id
  for update;

  if not found
     or v_user_id is distinct from p_user_id
     or not coalesce(v_verified, false)
     or not exists (select 1 from public.users where id = p_user_id and role = 'training_provider' and status = 'active') then
    return false;
  end if;

  update public.training_providers
  set provider_name = p_provider_name,
      contact_name = p_contact_name,
      contact_phone = p_contact_phone,
      tax_code = p_tax_code,
      province_code = p_province_code,
      license_number = p_license_number,
      description = p_description,
      updated_at = now()
  where id = p_provider_id;

  update public.users
  set full_name = p_contact_name,
      phone = p_contact_phone
  where id = p_user_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Training provider profile user update failed';
  end if;

  -- provider_slug, verification, account tier and logo are not changed here.
  return true;
end;
$$;

revoke all on function public.update_training_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_training_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text)
  to service_role;
