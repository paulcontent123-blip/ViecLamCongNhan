-- AI Matching (đề xuất việc làm và dịch vụ liên quan) và giới hạn tần suất dùng chung (chống spam).
-- Mọi bảng khóa khỏi anon/authenticated; chỉ API server dùng service role.

-- 1) Giới hạn tần suất chung: mỗi lần gọi ghi một dòng, đếm số dòng trong cửa sổ thời gian.
create table if not exists public.api_rate_events (
  id bigint generated always as identity primary key,
  scope text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_rate_events_lookup_idx
  on public.api_rate_events (scope, key_hash, created_at desc);

alter table public.api_rate_events enable row level security;
revoke all on public.api_rate_events from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
  v_oldest timestamptz;
begin
  if p_scope !~ '^[a-z0-9:_-]{1,60}$' or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    return query select false, 60;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rate:' || p_scope || ':' || p_key_hash, 0));

  -- Dọn dữ liệu cũ (mỗi sự kiện chỉ cần giữ trong cửa sổ dài nhất là 24 giờ).
  delete from public.api_rate_events where created_at < now() - interval '25 hours';

  select count(*)::integer, min(created_at) into v_count, v_oldest
  from public.api_rate_events
  where scope = p_scope and key_hash = p_key_hash
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return query select false, greatest(1, ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer);
    return;
  end if;

  insert into public.api_rate_events(scope, key_hash) values (p_scope, p_key_hash);
  return query select true, 0;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

-- 2) Tùy chọn gợi ý do chính công nhân đặt. Tỉnh trong hồ sơ có thể chỉ là nơi ở, nên nơi muốn làm lưu riêng.
create table if not exists public.candidate_match_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  work_province_code text,
  kcn_id uuid references public.kcn(id) on delete set null,
  interested_services text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint candidate_match_services_check
    check (interested_services <@ array['housing', 'training', 'insurance', 'health', 'finance']::text[])
);

alter table public.candidate_match_preferences enable row level security;
revoke all on public.candidate_match_preferences from anon, authenticated;

comment on table public.candidate_match_preferences is
  'Nơi muốn làm và dịch vụ công nhân chủ động quan tâm. Chỉ dùng để gợi ý; không chia sẻ cho đối tác.';

-- 3) Bộ nhớ đệm embedding của tin tuyển dụng. Chỉ lưu vector của nội dung công khai, không lưu dữ liệu cá nhân.
create table if not exists public.ai_embeddings (
  entity_type text not null check (entity_type in ('job')),
  entity_id uuid not null,
  model text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  embedding double precision[] not null,
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id, model)
);

alter table public.ai_embeddings enable row level security;
revoke all on public.ai_embeddings from anon, authenticated;

-- 4) Chống spam câu hỏi Hỏi đáp: dấu vân tay (băm) của nội dung đã chuẩn hóa kèm người liên hệ, để chặn gửi trùng trong 24 giờ.
alter table public.qa_questions add column if not exists question_fingerprint text;
create index if not exists qa_questions_fingerprint_idx
  on public.qa_questions (question_fingerprint, created_at desc);
