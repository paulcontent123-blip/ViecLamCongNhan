-- Thanh toán VietQR + ví MoMo (đối soát thủ công, giống luồng bên XemTarot/TruyenMa).
--
-- Luồng: NTD chọn phương thức -> hệ thống tạo đơn kèm MÃ ĐƠN (nội dung chuyển khoản)
-- -> hiện mã QR + thông tin nhận tiền -> NTD chuyển tiền rồi bấm "Tôi đã thanh toán"
-- (orders.customer_confirmed_at) -> Admin đối soát và bấm "Đã nhận tiền" (status='paid',
-- kích hoạt quyền lợi như cũ). Admin KHÔNG xác nhận được khi NTD chưa tự báo.
--
-- payment_accounts / momo_wallets bật RLS và không có policy: chỉ service role (API
-- routes phía server) đọc/ghi được, giống orders.

-- ── Tài khoản ngân hàng nhận tiền (sinh mã VietQR) ────────────
create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_code text not null
    constraint payment_accounts_bank_code_check check (bank_code ~ '^[A-Za-z0-9]{2,20}$'), -- mã ngân hàng VietQR: VCB, MB, TCB...
  bank_name text not null
    constraint payment_accounts_bank_name_check check (char_length(bank_name) between 2 and 100),
  account_no text not null
    constraint payment_accounts_account_no_check check (account_no ~ '^\d{6,20}$'),
  account_name text not null
    constraint payment_accounts_account_name_check check (char_length(account_name) between 2 and 100),
  is_active boolean not null default false, -- tài khoản đang hiện ở màn hình thanh toán
  created_at timestamptz not null default now()
);

-- Chỉ một tài khoản được bật tại một thời điểm.
create unique index if not exists payment_accounts_one_active_idx
  on public.payment_accounts (is_active)
  where is_active;

alter table public.payment_accounts enable row level security;

-- ── Ví MoMo nhận tiền ─────────────────────────────────────────
-- Ví cá nhân/doanh nghiệp, không phải cổng MoMo API: admin tải ảnh QR nhận tiền lên,
-- NTD quét rồi tự báo đã chuyển — đối soát y hệt chuyển khoản ngân hàng.
create table if not exists public.momo_wallets (
  id uuid primary key default gen_random_uuid(),
  phone text not null
    constraint momo_wallets_phone_check check (phone ~ '^0\d{9}$'),
  owner_name text not null
    constraint momo_wallets_owner_name_check check (char_length(owner_name) between 2 and 100),
  qr_url text
    constraint momo_wallets_qr_url_check check (qr_url is null or (qr_url ~ '^https://' and char_length(qr_url) <= 500)),
  note text
    constraint momo_wallets_note_check check (note is null or char_length(note) <= 200),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists momo_wallets_one_active_idx
  on public.momo_wallets (is_active)
  where is_active;

alter table public.momo_wallets enable row level security;

-- ── Đơn hàng: mã đơn + mốc NTD tự báo đã chuyển + nơi nhận tiền ─
alter table public.orders
  add column if not exists code text,                      -- nội dung chuyển khoản để đối soát (VLxxxxxx)
  add column if not exists customer_confirmed_at timestamptz, -- NTD bấm "Tôi đã thanh toán"
  add column if not exists payment_account_id uuid references public.payment_accounts (id) on delete set null,
  add column if not exists momo_wallet_id uuid references public.momo_wallets (id) on delete set null,
  add column if not exists reject_reason text;             -- Admin không đối soát được: lý do để NTD bổ sung

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_code_check') then
    alter table public.orders
      add constraint orders_code_check check (code is null or code ~ '^VL[A-Z0-9]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_reject_reason_check') then
    alter table public.orders
      add constraint orders_reject_reason_check check (reject_reason is null or char_length(reject_reason) <= 300);
  end if;
end
$$;

-- Đơn cũ (trước migration này) không có mã nên cho phép null, chỉ ràng buộc duy nhất khi có mã.
create unique index if not exists orders_code_key on public.orders (code) where code is not null;
