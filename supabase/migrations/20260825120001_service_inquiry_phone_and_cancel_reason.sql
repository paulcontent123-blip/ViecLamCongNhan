-- Liên kết yêu cầu tư vấn với tài khoản Nhà tuyển dụng bằng số điện thoại.
-- Không gắn cứng employer_id để tài khoản được tạo sau này bằng cùng số vẫn
-- xem được các yêu cầu đã đặt trước đó.
alter table public.service_inquiries
  add column if not exists phone_normalized text,
  add column if not exists cancel_reason text;

with normalized as (
  select
    id,
    regexp_replace(phone, '[^0-9]', '', 'g') as digits
  from public.service_inquiries
)
update public.service_inquiries as inquiries
set phone_normalized = case
  when normalized.digits ~ '^84[0-9]{9}$' then '0' || substr(normalized.digits, 3)
  else normalized.digits
end
from normalized
where inquiries.id = normalized.id
  and inquiries.phone_normalized is null;

create index if not exists service_inquiries_phone_normalized_idx
  on public.service_inquiries (phone_normalized);
