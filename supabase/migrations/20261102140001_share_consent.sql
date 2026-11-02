-- C1: công nhân đồng ý RIÊNG (không bắt buộc) cho Admin chia sẻ họ tên, số điện thoại và nhu cầu cho đối tác phù hợp.
-- Chạy sau 20261102130001_worker_inquiries_to_admin.sql và TRƯỚC khi deploy web (web đọc hai cột mới qua view).
--   share_consent_at / share_consent_version : chỉ có giá trị khi app gửi shareConsent = true cùng phiên bản văn bản đồng ý.
--       Bản ghi cũ và bản ghi từ app bản cũ để NULL nên không bao giờ được xuất cho đối tác.
-- Việc lọc và xuất CSV do Superadmin làm ở trang Yêu cầu dịch vụ công nhân; không có bảng ghi lô xuất (mỗi lần xuất chỉ ghi vào admin_audit_log).
do $$
declare
  t text;
begin
  foreach t in array array['vocational_inquiries', 'vocational_applications', 'insurance_inquiries', 'finance_inquiries'] loop
    execute format('alter table public.%I
      add column if not exists share_consent_at timestamptz,
      add column if not exists share_consent_version text', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_share_consent_check');
    execute format('alter table public.%I add constraint %I check ((share_consent_at is null) = (share_consent_version is null))', t, t || '_share_consent_check');
    execute format('create index if not exists %I on public.%I (share_consent_at) where share_consent_at is not null', t || '_share_consent_idx', t);
  end loop;
end $$;

-- Hàng đợi chung của Admin, thêm hai cột đồng ý chia sẻ ở cuối (create or replace chỉ cho thêm cột ở cuối).
create or replace view public.admin_worker_inquiries as
  select 'vocational_inquiry'::text as kind, vi.id, vi.full_name, vi.phone, vi.email, vi.message,
         c.title as subject, p.provider_name, null::jsonb as extra, vi.status as partner_status,
         vi.routed_to, vi.admin_status, vi.admin_note, vi.forwarded_at, vi.created_at, vi.updated_at,
         vi.share_consent_at, vi.share_consent_version
    from public.vocational_inquiries vi
    join public.vocational_courses c on c.id = vi.course_id
    join public.training_providers p on p.id = vi.provider_id
  union all
  select 'vocational_application'::text, va.id, va.full_name, va.phone, va.email, va.message,
         c.title, p.provider_name, null::jsonb, va.status,
         va.routed_to, va.admin_status, va.admin_note, va.forwarded_at, va.created_at, va.updated_at,
         va.share_consent_at, va.share_consent_version
    from public.vocational_applications va
    join public.vocational_courses c on c.id = va.course_id
    join public.training_providers p on p.id = va.provider_id
  union all
  select 'insurance_inquiry'::text, ii.id, ii.full_name, ii.phone, ii.email, ii.message,
         ip.title, pr.provider_name, null::jsonb, ii.status,
         ii.routed_to, ii.admin_status, ii.admin_note, ii.forwarded_at, ii.created_at, ii.updated_at,
         ii.share_consent_at, ii.share_consent_version
    from public.insurance_inquiries ii
    join public.insurance_products ip on ip.id = ii.product_id
    join public.insurance_providers pr on pr.id = ii.provider_id
  union all
  select 'finance_inquiry'::text, fi.id, fi.full_name, fi.phone, fi.email, fi.message,
         fp.title, pr.provider_name,
         jsonb_build_object('category', fi.category, 'topic', fi.inquiry_topic, 'province_code', fi.province_code, 'destination_province_code', fi.destination_province_code),
         fi.status, fi.routed_to, fi.admin_status, fi.admin_note, fi.forwarded_at, fi.created_at, fi.updated_at,
         fi.share_consent_at, fi.share_consent_version
    from public.finance_inquiries fi
    join public.finance_products fp on fp.id = fi.product_id
    join public.finance_providers pr on pr.id = fi.provider_id;

revoke all on public.admin_worker_inquiries from public, anon, authenticated;
grant select on public.admin_worker_inquiries to service_role;
