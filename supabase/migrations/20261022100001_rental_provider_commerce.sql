-- Đưa gói tài khoản và đơn hàng (VietQR/MoMo) cho Đối tác Thuê trọ, dùng cùng luồng như NTD và Đơn vị đào tạo.
-- Hạn mức xem liên hệ yêu cầu thuê tính theo gói; cột contact_view_limit do Admin cấp tay không còn được dùng.

alter table public.rental_providers
  add column if not exists account_type text not null default 'free',
  add column if not exists account_tier_expires_at timestamptz;

alter table public.rental_providers
  drop constraint if exists rental_providers_account_type_check;
alter table public.rental_providers
  add constraint rental_providers_account_type_check check (account_type in ('free', 'basic', 'premium'));

comment on column public.rental_providers.contact_view_limit is
  'Không còn được dùng: hạn mức xem liên hệ tính theo account_type (free 0, basic 60, premium 300).';

alter table public.orders
  add column if not exists rental_provider_id uuid references public.rental_providers(id) on delete restrict;

create index if not exists orders_rental_provider_id_idx
  on public.orders(rental_provider_id, created_at desc);

-- Mỗi đơn thuộc đúng một chủ: NTD, đơn vị đào tạo hoặc chủ trọ.
alter table public.orders
  drop constraint if exists orders_single_owner_check;
alter table public.orders
  add constraint orders_single_owner_check
  check (
    (employer_id is not null)::integer
    + (training_provider_id is not null)::integer
    + (rental_provider_id is not null)::integer = 1
  ) not valid;

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
  v_limit integer;
begin
  select * into v_provider from public.rental_providers where id = p_provider_id for update;
  if not found then raise exception 'RENTAL_PROVIDER_NOT_FOUND'; end if;
  if not v_provider.is_verified then raise exception 'RENTAL_PROVIDER_UNVERIFIED'; end if;

  -- Gói hết hạn tự hạ về Free khi đọc, giống NTD và đơn vị đào tạo.
  if v_provider.account_type <> 'free'
     and v_provider.account_tier_expires_at is not null
     and v_provider.account_tier_expires_at <= now() then
    update public.rental_providers set account_type = 'free', account_tier_expires_at = null where id = p_provider_id;
    v_provider.account_type := 'free';
  end if;
  v_limit := case v_provider.account_type when 'premium' then 300 when 'basic' then 60 else 0 end;

  select * into v_inquiry from public.rental_inquiries
    where id = p_inquiry_id and provider_id = p_provider_id and contact_consent = true;
  if not found then raise exception 'RENTAL_INQUIRY_NOT_FOUND'; end if;

  select count(*)::integer into v_count from public.rental_provider_contact_views
    where provider_id = p_provider_id and period_start = p_period_start;
  if exists (select 1 from public.rental_provider_contact_views
      where provider_id = p_provider_id and inquiry_id = p_inquiry_id and period_start = p_period_start) then
    return query select v_inquiry.phone, v_inquiry.email, v_count, v_limit;
    return;
  end if;
  if v_count >= v_limit then raise exception 'RENTAL_CONTACT_LIMIT'; end if;

  insert into public.rental_provider_contact_views(provider_id, inquiry_id, period_start)
    values (p_provider_id, p_inquiry_id, p_period_start);
  return query select v_inquiry.phone, v_inquiry.email, v_count + 1, v_limit;
end;
$$;

revoke all on function public.view_rental_inquiry_contact(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.view_rental_inquiry_contact(uuid, uuid, date) to service_role;
