-- Đồng bộ trạng thái đơn ứng tuyển sang hồ sơ candidate để Admin không thấy
-- một hồ sơ đã được tuyển/từ chối nhưng vẫn hiển thị "Đang tìm việc".
-- applications.status vẫn là nguồn dữ liệu chi tiết theo từng tin.

alter table public.candidates drop constraint if exists candidates_status_check;
alter table public.candidates
  add constraint candidates_status_check
  check (status in ('new', 'viewed', 'contacted', 'rejected', 'hired', 'inactive'));

create or replace function public.sync_candidate_status_from_applications(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_status text;
begin
  if p_candidate_id is null then
    return;
  end if;

  -- Nếu có nhiều đơn, giữ trạng thái có ý nghĩa nghiệp vụ cao nhất. Một đơn
  -- bị từ chối không làm ứng viên ngừng tìm việc nếu vẫn còn đơn đang xử lý.
  select case
    when bool_or(status = 'hired') then 'hired'
    when bool_or(status = 'contacted') then 'contacted'
    when bool_or(status = 'viewed') then 'viewed'
    when bool_or(status = 'new') then 'new'
    when bool_and(status = 'rejected') then 'rejected'
    else null
  end
  into next_status
  from public.applications
  where candidate_id = p_candidate_id;

  -- Không có application: giữ nguyên trạng thái do Admin/form nhanh quản lý.
  if next_status is not null then
    update public.candidates
    set status = next_status
    where id = p_candidate_id;
  end if;
end;
$$;

create or replace function public.sync_candidate_status_after_application_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_candidate_status_from_applications(old.candidate_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.candidate_id is distinct from new.candidate_id then
    perform public.sync_candidate_status_from_applications(old.candidate_id);
  end if;

  perform public.sync_candidate_status_from_applications(new.candidate_id);
  return new;
end;
$$;

drop trigger if exists applications_sync_candidate_status on public.applications;
create trigger applications_sync_candidate_status
after insert or delete or update of candidate_id, status on public.applications
for each row execute function public.sync_candidate_status_after_application_change();

-- Backfill các candidate đã có application trước khi migration được chạy.
do $$
declare
  candidate_record record;
begin
  for candidate_record in
    select distinct candidate_id
    from public.applications
    where candidate_id is not null
  loop
    perform public.sync_candidate_status_from_applications(candidate_record.candidate_id);
  end loop;
end;
$$;

comment on column public.candidates.status is
  'Trạng thái hồ sơ; với candidate có application, giá trị được đồng bộ từ applications.status';
