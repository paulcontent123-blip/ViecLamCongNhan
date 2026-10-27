-- Speed up the global retention delete in consume_rate_limit, which filters only by created_at.
-- Apply after 20261026130001_ai_matching_and_rate_limits.sql.
create index if not exists api_rate_events_created_at_idx
  on public.api_rate_events (created_at);
