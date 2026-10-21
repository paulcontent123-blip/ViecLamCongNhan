-- Allow unverified training providers to complete their profile and logo.
-- A change to legal identity fields automatically requires Admin verification again.
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
  v_provider_name text;
  v_tax_code text;
  v_license_number text;
  v_reverification_required boolean := false;
  v_updated integer;
begin
  select user_id, is_verified, provider_name, tax_code, license_number
    into v_user_id, v_verified, v_provider_name, v_tax_code, v_license_number
  from public.training_providers
  where id = p_provider_id
  for update;

  if not found
     or v_user_id is distinct from p_user_id
     or not exists (
       select 1 from public.users
       where id = p_user_id and role = 'training_provider' and status = 'active'
     ) then
    return false;
  end if;

  v_reverification_required := coalesce(v_verified, false) and (
    v_provider_name is distinct from p_provider_name
    or v_tax_code is distinct from p_tax_code
    or v_license_number is distinct from p_license_number
  );

  update public.training_providers
  set provider_name = p_provider_name,
      contact_name = p_contact_name,
      contact_phone = p_contact_phone,
      tax_code = p_tax_code,
      province_code = p_province_code,
      license_number = p_license_number,
      description = p_description,
      is_verified = case when v_reverification_required then false else is_verified end,
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

  -- provider_slug, account tier and logo are intentionally preserved.
  return true;
end;
$$;

revoke all on function public.update_training_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_training_provider_profile_atomically(uuid, uuid, text, text, text, text, text, text, text)
  to service_role;

-- Serialize course submission/approval against changes to the provider's
-- verification row. This closes the gap between API prechecks and the write.
create or replace function public.guard_training_provider_course_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_verified boolean;
begin
  if new.status not in ('pending', 'approved') then
    return new;
  end if;

  select is_verified into v_is_verified
  from public.training_providers
  where id = new.provider_id
  for update;

  if not found or not coalesce(v_is_verified, false) then
    raise exception using errcode = 'P0001', message = 'PROVIDER_UNVERIFIED';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_training_provider_course_verification() from public, anon, authenticated;
grant execute on function public.guard_training_provider_course_verification() to service_role;

drop trigger if exists vocational_course_provider_verification_gate on public.vocational_courses;
create trigger vocational_course_provider_verification_gate
before insert or update on public.vocational_courses
for each row execute function public.guard_training_provider_course_verification();
