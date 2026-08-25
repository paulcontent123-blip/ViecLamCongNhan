-- Mở rộng bảng jobs để các bộ lọc dạng tag trên UI (bản HTML demo cũ chỉ là nút
-- tĩnh, không lọc được gì) lọc được thật theo dữ liệu.
alter table public.jobs
  add column if not exists is_urgent boolean not null default false,
  add column if not exists has_housing boolean not null default false,
  add column if not exists has_shuttle boolean not null default false,
  add column if not exists has_meals boolean not null default false,
  add column if not exists no_experience_required boolean not null default false,
  add column if not exists shift_type text
    constraint jobs_shift_type_check check (shift_type is null or shift_type in ('day', 'night', 'rotating'));

comment on column public.jobs.is_urgent is 'Hiển thị badge "Tuyển gấp" + lọc nhanh trên trang Tìm việc làm.';
comment on column public.jobs.shift_type is 'day = Ca ngày, night = Ca đêm, rotating = Ca xoay.';

create index if not exists jobs_is_urgent_idx on public.jobs (is_urgent) where is_urgent = true;
