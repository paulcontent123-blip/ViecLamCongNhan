-- Việc làm đã lưu của công nhân, lưu trên máy chủ để dùng được trên web (app hiện lưu cục bộ trên máy).
-- Chỉ THÊM bảng và hàm mới; không đổi bảng nào đang có.
create table if not exists public.candidate_saved_jobs (
  user_id uuid not null references public.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists candidate_saved_jobs_user_created_idx
  on public.candidate_saved_jobs (user_id, created_at desc);

-- Tối đa 100 việc đã lưu mỗi tài khoản, giống giới hạn của app. Kiểm tra bằng trigger để hai yêu cầu
-- đồng thời không cùng vượt giới hạn.
create or replace function public.enforce_candidate_saved_jobs_limit()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.candidate_saved_jobs where user_id = new.user_id) >= 100 then
    raise exception 'SAVED_JOBS_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists candidate_saved_jobs_limit_trg on public.candidate_saved_jobs;
create trigger candidate_saved_jobs_limit_trg
  before insert on public.candidate_saved_jobs
  for each row execute function public.enforce_candidate_saved_jobs_limit();

-- Chỉ service_role (route phía máy chủ) đọc và ghi; người dùng không truy cập bảng trực tiếp.
alter table public.candidate_saved_jobs enable row level security;
revoke all on public.candidate_saved_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.candidate_saved_jobs to service_role;

comment on table public.candidate_saved_jobs is
  'Việc công nhân đã lưu để xem lại. Chỉ chủ tài khoản đọc qua api/mobile/candidate/saved-jobs; không chia sẻ cho ai.';
