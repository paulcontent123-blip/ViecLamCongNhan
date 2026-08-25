-- Phân loại yêu cầu để sau này dùng chung bảng cho Dịch vụ trọn gói,
-- Quảng cáo/Hợp tác và các loại dịch vụ khác.
alter table public.service_inquiries
  add column if not exists type text;

update public.service_inquiries
set type = 'Dịch vụ trọn gói'
where type is null;

alter table public.service_inquiries
  alter column type set default 'Dịch vụ trọn gói',
  alter column type set not null;

-- Hủy đăng ký là trạng thái cuối của yêu cầu; không giới hạn type để có thể
-- bổ sung thêm loại dịch vụ trong các migration sau.
alter table public.service_inquiries
  drop constraint if exists service_inquiries_status_check;

alter table public.service_inquiries
  add constraint service_inquiries_status_check
  check (status in ('new', 'consulted', 'cancelled'));

create index if not exists service_inquiries_type_idx on public.service_inquiries (type);
