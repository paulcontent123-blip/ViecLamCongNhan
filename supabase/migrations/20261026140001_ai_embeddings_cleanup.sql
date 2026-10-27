-- Dọn bộ nhớ đệm embedding: xóa vector của tin không còn tồn tại và tự dọn tin hết hiệu lực hoặc quá cũ.
-- Áp sau 20261026130001_ai_matching_and_rate_limits.sql.

-- Vector mồ côi (tin đã bị xóa) bị loại trước khi gắn khóa ngoại.
delete from public.ai_embeddings e
where e.entity_type = 'job'
  and not exists (select 1 from public.jobs j where j.id = e.entity_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_embeddings_job_fk' and conrelid = 'public.ai_embeddings'::regclass
  ) then
    alter table public.ai_embeddings
      add constraint ai_embeddings_job_fk foreign key (entity_id) references public.jobs(id) on delete cascade;
  end if;
end;
$$;

-- Xóa vector của tin chưa/không còn được duyệt, đã hết hạn, hoặc không được làm mới quá p_max_age.
-- API gợi ý gọi hàm này ngẫu nhiên khoảng 5% số lần; vector sẽ được tạo lại khi tin được duyệt trở lại.
create or replace function public.cleanup_ai_embeddings(p_max_age interval default interval '30 days')
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.ai_embeddings e
  where e.updated_at < now() - p_max_age
     or not exists (
       select 1 from public.jobs j
       where j.id = e.entity_id and j.status = 'approved' and (j.expires_at is null or j.expires_at > now())
     );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_ai_embeddings(interval) from public, anon, authenticated;
grant execute on function public.cleanup_ai_embeddings(interval) to service_role;
