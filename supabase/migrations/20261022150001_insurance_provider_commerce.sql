-- Shared Basic/Premium subscriptions for insurance partners.
-- Subscription quota stays scoped to insurance inquiries. A positive Admin-set
-- contact_view_limit remains a manual override; zero uses the active plan quota.

alter table public.insurance_providers
  add column if not exists account_type text not null default 'free',
  add column if not exists account_tier_expires_at timestamptz;

alter table public.insurance_providers
  drop constraint if exists insurance_providers_account_type_check;
alter table public.insurance_providers
  add constraint insurance_providers_account_type_check
  check (account_type in ('free', 'basic', 'premium'));

comment on column public.insurance_providers.contact_view_limit is
  'Admin manual monthly contact-view override. A positive value takes precedence; zero uses the account plan quota (Free 0, Basic 60, Premium 300).';

alter table public.orders
  add column if not exists insurance_provider_id uuid references public.insurance_providers(id) on delete restrict;

create index if not exists orders_insurance_provider_id_idx
  on public.orders(insurance_provider_id, created_at desc);

-- Each order belongs to exactly one account owner: employer, training, rental,
-- or insurance partner. Preserve existing owner rows.
alter table public.orders
  drop constraint if exists orders_single_owner_check;
alter table public.orders
  add constraint orders_single_owner_check
  check (
    (employer_id is not null)::integer
    + (training_provider_id is not null)::integer
    + (rental_provider_id is not null)::integer
    + (insurance_provider_id is not null)::integer = 1
  ) not valid;

create or replace function public.view_insurance_inquiry_contact(
  p_provider_id uuid,
  p_inquiry_id uuid,
  p_period_start date
) returns table(phone text, email text, viewed_count integer, view_limit integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_provider public.insurance_providers%rowtype;
  v_inquiry public.insurance_inquiries%rowtype;
  v_count integer;
  v_limit integer;
begin
  select * into v_provider from public.insurance_providers where id = p_provider_id for update;
  if not found then raise exception 'PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'PROVIDER_UNVERIFIED'; end if;

  if v_provider.account_type <> 'free'
     and v_provider.account_tier_expires_at is not null
     and v_provider.account_tier_expires_at <= now() then
    update public.insurance_providers
      set account_type = 'free', account_tier_expires_at = null
      where id = p_provider_id;
    v_provider.account_type := 'free';
    v_provider.account_tier_expires_at := null;
  end if;

  v_limit := case v_provider.account_type
    when 'premium' then 300
    when 'basic' then 60
    else 0
  end;
  if v_provider.contact_view_limit > 0 then
    v_limit := v_provider.contact_view_limit;
  end if;

  select * into v_inquiry from public.insurance_inquiries
    where id = p_inquiry_id and provider_id = p_provider_id and contact_consent = true;
  if not found then raise exception 'INQUIRY_NOT_AVAILABLE'; end if;

  select count(*)::integer into v_count
    from public.insurance_provider_contact_views
    where provider_id = p_provider_id and period_start = p_period_start;
  if exists (
    select 1 from public.insurance_provider_contact_views
    where provider_id = p_provider_id and inquiry_id = p_inquiry_id and period_start = p_period_start
  ) then
    return query select v_inquiry.phone, v_inquiry.email, v_count, v_limit;
    return;
  end if;
  if v_count >= v_limit then raise exception 'CONTACT_LIMIT'; end if;

  insert into public.insurance_provider_contact_views(provider_id, inquiry_id, period_start)
    values (p_provider_id, p_inquiry_id, p_period_start);
  return query select v_inquiry.phone, v_inquiry.email, v_count + 1, v_limit;
end;
$$;

revoke all on function public.view_insurance_inquiry_contact(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.view_insurance_inquiry_contact(uuid, uuid, date) to service_role;
