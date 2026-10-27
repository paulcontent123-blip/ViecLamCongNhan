-- Move retention cleanup out of the request path. The created_at index from
-- 20261027100001_rate_limit_cleanup_index.sql supports this periodic delete.
create extension if not exists pg_cron with schema pg_catalog;

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

create or replace function public.cleanup_api_rate_events()
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from public.api_rate_events
  where created_at < now() - interval '25 hours';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_api_rate_events() from public, anon, authenticated;
grant execute on function public.cleanup_api_rate_events() to service_role;

-- Reusing this job name updates the schedule if this migration is reapplied.
select cron.schedule(
  'cleanup-api-rate-events',
  '17 * * * *',
  $$select public.cleanup_api_rate_events();$$
);
