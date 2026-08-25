-- Theo dõi thời điểm đơn ứng tuyển được cập nhật.
-- Trạng thái tuyển dụng nằm ở applications vì một ứng viên có thể ứng tuyển
-- nhiều tin và có kết quả khác nhau ở từng tin.
alter table public.applications
  add column if not exists updated_at timestamptz not null default now();

create index if not exists applications_status_idx on public.applications (status);

create or replace function public.set_applications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_applications_updated_at();

comment on column public.applications.status is
  'Trạng thái của đơn ứng tuyển theo từng tin: new | viewed | contacted | rejected | hired';
