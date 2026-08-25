-- Blast SMS/Zalo
create table if not exists public.sms_blasts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs (id) on delete cascade,
  employer_id uuid references public.employers (id) on delete cascade,
  target_provinces text[],
  target_industries text[],
  message text not null,
  channel text not null default 'sms'
    constraint sms_blasts_channel_check check (channel in ('sms', 'zalo', 'both')),
  recipient_count integer,
  sent_count integer not null default 0,
  cost_vnd integer,
  status text not null default 'queued'
    constraint sms_blasts_status_check check (status in ('queued', 'sending', 'done', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz
);

create index if not exists sms_blasts_employer_id_idx on public.sms_blasts (employer_id);
create index if not exists sms_blasts_status_idx on public.sms_blasts (status);
