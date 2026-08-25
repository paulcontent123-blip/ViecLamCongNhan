-- Đơn hàng & Thanh toán
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references public.employers (id) on delete cascade,
  order_type text
    constraint orders_order_type_check check (
      order_type is null or order_type in ('job_post', 'sms_blast', 'rpo_service', 'banner')
    ),
  tier text,
  amount integer not null, -- VNĐ
  payment_method text
    constraint orders_payment_method_check check (
      payment_method is null or payment_method in ('bank_transfer', 'vnpay', 'momo')
    ),
  payment_ref text,
  status text not null default 'pending'
    constraint orders_status_check check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orders_employer_id_idx on public.orders (employer_id);
create index if not exists orders_status_idx on public.orders (status);
