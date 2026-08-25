-- RLS: mọi ghi/đọc dữ liệu nhạy cảm đi qua API routes (server-side, dùng service role
-- key nên bypass RLS). anon/authenticated key (nếu lộ ra client) chỉ được đọc dữ liệu
-- công khai đã liệt kê dưới đây, không có quyền ghi vào bất kỳ bảng nào.

alter table public.users enable row level security;
alter table public.employers enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.kcn enable row level security;
alter table public.sms_blasts enable row level security;
alter table public.orders enable row level security;
alter table public.revenue_partners enable row level security;

-- Tin tuyển dụng đã duyệt: công khai
create policy "jobs_public_read_approved" on public.jobs
  for select
  to anon, authenticated
  using (status = 'approved');

-- KCN Directory: công khai toàn bộ
create policy "kcn_public_read" on public.kcn
  for select
  to anon, authenticated
  using (true);

-- Đối tác doanh thu đang active: công khai (hiển thị banner/link affiliate)
create policy "revenue_partners_public_read_active" on public.revenue_partners
  for select
  to anon, authenticated
  using (is_active = true);

-- users / employers / candidates / applications / sms_blasts / orders:
-- không có policy nào cho anon/authenticated => mặc định deny.
-- Chỉ service_role (dùng trong API routes phía server) mới đọc/ghi được.
