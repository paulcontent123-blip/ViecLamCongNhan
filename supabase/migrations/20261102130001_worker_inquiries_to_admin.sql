-- Ưu tiên 5: yêu cầu dịch vụ của công nhân (Học nghề, Bảo hiểm, Tài chính) đi về Admin trước, Admin chuyển cho đối tác sau.
-- Thuê trọ và Y tế giữ nguyên (gửi thẳng đối tác).
-- Chạy migration này TRƯỚC khi deploy web: các route đối tác lọc theo routed_to.
--   routed_to    : 'admin' = đang ở hàng đợi Admin, đối tác chưa thấy; 'provider' = đã chuyển (hoặc yêu cầu cũ trước thay đổi này).
--   admin_status : trạng thái xử lý của Admin khi yêu cầu còn ở Admin (new, contacted, closed).
--   status       : trạng thái đối tác tự cập nhật sau khi nhận yêu cầu (giữ nguyên).
-- Yêu cầu có sẵn được giữ routed_to = 'provider' để đối tác không mất yêu cầu cũ; yêu cầu mới mặc định về 'admin'.
do $$
declare
  t text;
begin
  foreach t in array array['vocational_inquiries', 'vocational_applications', 'insurance_inquiries', 'finance_inquiries'] loop
    execute format('alter table public.%I
      add column if not exists routed_to text not null default ''provider'',
      add column if not exists admin_status text not null default ''new'',
      add column if not exists admin_note text,
      add column if not exists forwarded_at timestamptz,
      add column if not exists forwarded_by uuid', t);
    execute format('alter table public.%I alter column routed_to set default ''admin''', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_routed_to_check');
    execute format('alter table public.%I add constraint %I check (routed_to in (''admin'', ''provider''))', t, t || '_routed_to_check');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_admin_status_check');
    execute format('alter table public.%I add constraint %I check (admin_status in (''new'', ''contacted'', ''closed''))', t, t || '_admin_status_check');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_admin_note_check');
    execute format('alter table public.%I add constraint %I check (admin_note is null or char_length(admin_note) <= 1000)', t, t || '_admin_note_check');
    execute format('create index if not exists %I on public.%I (routed_to, admin_status, created_at desc)', t || '_admin_queue_idx', t);
  end loop;
end $$;

-- Hàng đợi chung cho Admin: gộp 4 nguồn thành một danh sách để lọc, tìm và phân trang một lần.
create or replace view public.admin_worker_inquiries as
  select 'vocational_inquiry'::text as kind, vi.id, vi.full_name, vi.phone, vi.email, vi.message,
         c.title as subject, p.provider_name, null::jsonb as extra, vi.status as partner_status,
         vi.routed_to, vi.admin_status, vi.admin_note, vi.forwarded_at, vi.created_at, vi.updated_at
    from public.vocational_inquiries vi
    join public.vocational_courses c on c.id = vi.course_id
    join public.training_providers p on p.id = vi.provider_id
  union all
  select 'vocational_application'::text, va.id, va.full_name, va.phone, va.email, va.message,
         c.title, p.provider_name, null::jsonb, va.status,
         va.routed_to, va.admin_status, va.admin_note, va.forwarded_at, va.created_at, va.updated_at
    from public.vocational_applications va
    join public.vocational_courses c on c.id = va.course_id
    join public.training_providers p on p.id = va.provider_id
  union all
  select 'insurance_inquiry'::text, ii.id, ii.full_name, ii.phone, ii.email, ii.message,
         ip.title, pr.provider_name, null::jsonb, ii.status,
         ii.routed_to, ii.admin_status, ii.admin_note, ii.forwarded_at, ii.created_at, ii.updated_at
    from public.insurance_inquiries ii
    join public.insurance_products ip on ip.id = ii.product_id
    join public.insurance_providers pr on pr.id = ii.provider_id
  union all
  select 'finance_inquiry'::text, fi.id, fi.full_name, fi.phone, fi.email, fi.message,
         fp.title, pr.provider_name,
         jsonb_build_object('category', fi.category, 'topic', fi.inquiry_topic, 'province_code', fi.province_code, 'destination_province_code', fi.destination_province_code),
         fi.status, fi.routed_to, fi.admin_status, fi.admin_note, fi.forwarded_at, fi.created_at, fi.updated_at
    from public.finance_inquiries fi
    join public.finance_products fp on fp.id = fi.product_id
    join public.finance_providers pr on pr.id = fi.provider_id;

comment on view public.admin_worker_inquiries is
  'Yêu cầu dịch vụ của công nhân (học nghề, hồ sơ học viên, bảo hiểm, tài chính) cho màn Admin. Chỉ service_role đọc.';

revoke all on public.admin_worker_inquiries from public, anon, authenticated;
grant select on public.admin_worker_inquiries to service_role;
