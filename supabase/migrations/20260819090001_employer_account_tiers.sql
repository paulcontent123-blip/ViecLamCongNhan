-- Làm lại quyền lợi tài khoản NTD: chuyển từ "mua gói theo từng tin" (basic/featured
-- trả 1 lần/tin) sang "thuê bao tài khoản theo tháng" (Free/Basic/Premium áp dụng cho
-- toàn bộ hoạt động của tài khoản). Gói "Chiến dịch" (mua thêm riêng/tin) giữ nguyên,
-- độc lập với thuê bao tài khoản.

-- employers.account_type trước đây là field mồ côi (default 'basic' nhưng không có
-- logic nào ghi/đọc thực tế ngoài hiển thị) — reset về 'free' cho toàn bộ dữ liệu hiện
-- có vì giá trị cũ chưa từng phản ánh một gói đã mua thật sự.
-- Drop constraint cũ TRƯỚC khi update, vì 'free' không nằm trong constraint cũ
-- (chỉ cho basic/featured/enterprise) — update trước sẽ vi phạm constraint cũ.
alter table public.employers drop constraint employers_account_type_check;
update public.employers set account_type = 'free';
alter table public.employers alter column account_type set default 'free';
alter table public.employers add constraint employers_account_type_check
  check (account_type in ('free', 'basic', 'premium'));

alter table public.employers add column if not exists account_tier_expires_at timestamptz;
comment on column public.employers.account_type is
  'Gói thuê bao tài khoản hiện tại (free/basic/premium) — nguồn sự thật ở apps/web/src/lib/account-tiers.ts. Free không hết hạn (account_tier_expires_at = null).';
comment on column public.employers.account_tier_expires_at is
  'Ngày hết hạn thuê bao Basic/Premium. Khi đọc, nếu đã qua hạn mà account_type != free thì tự động hạ về free (xem getEmployerAccountTier) — tin đã đăng trước đó giữ nguyên, không bị ẩn.';

-- jobs.tier: đổi 'featured' -> 'premium' cho khớp tên gói mới. Từ nay tier của tin
-- KHÔNG còn được NTD chọn/mua riêng cho basic & premium — được gán tự động theo
-- account_type của tài khoản tại thời điểm đăng (xem createEmployerJob). 'campaign'
-- vẫn là gói mua thêm riêng, chọn thủ công + trả phí per tin như cũ.
-- Drop constraint cũ TRƯỚC khi update, vì 'premium' không nằm trong constraint cũ.
alter table public.jobs drop constraint jobs_tier_check;
update public.jobs set tier = 'premium' where tier = 'featured';
alter table public.jobs add constraint jobs_tier_check
  check (tier in ('free', 'basic', 'premium', 'campaign'));

-- Trọng số hiển thị: tin của tài khoản Premium / gói Chiến dịch được ưu tiên lên đầu
-- danh sách tìm kiếm & trang chủ (quyền lợi "hiển thị profile công ty ngoài trang chủ").
alter table public.jobs add column if not exists tier_weight smallint generated always as (
  case tier
    when 'premium' then 3
    when 'campaign' then 3
    when 'basic' then 2
    else 1
  end
) stored;

create index if not exists jobs_tier_weight_idx on public.jobs (tier_weight desc, created_at desc);

-- orders.order_type: thêm loại đơn hàng cho thuê bao tài khoản (Basic/Premium theo tháng).
alter table public.orders drop constraint orders_order_type_check;
alter table public.orders add constraint orders_order_type_check
  check (order_type is null or order_type in ('job_post', 'account_subscription', 'sms_blast', 'rpo_service', 'banner'));

-- Theo dõi lượt xem hồ sơ ứng viên/tháng của NTD (quyền lợi Basic 60, Premium 300 hồ
-- sơ/tháng). Chỉ đếm ứng viên DUY NHẤT: unique theo (employer_id, candidate_id,
-- period_start) nên xem lại cùng 1 ứng viên trong tháng không trừ thêm lượt.
create table if not exists public.employer_candidate_views (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  period_start date not null, -- ngày 1 đầu tháng dương lịch tại thời điểm xem
  viewed_at timestamptz not null default now(),
  unique (employer_id, candidate_id, period_start)
);

create index if not exists employer_candidate_views_quota_idx
  on public.employer_candidate_views (employer_id, period_start);

alter table public.employer_candidate_views enable row level security;
-- Không có policy cho anon/authenticated => mặc định deny, chỉ service_role (API routes) đọc/ghi được.
