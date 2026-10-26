-- Additional worker-owned profile preferences. Nullable values preserve older profiles
-- and distinguish "not answered" from an explicit No for housing.
alter table public.candidates
  add column if not exists date_of_birth date,
  add column if not exists preferred_shift text,
  add column if not exists needs_housing boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'candidates_preferred_shift_check'
      and conrelid = 'public.candidates'::regclass
  ) then
    alter table public.candidates
      add constraint candidates_preferred_shift_check
      check (preferred_shift is null or preferred_shift in ('day', 'night', 'rotating', 'flexible'));
  end if;
end;
$$;

comment on column public.candidates.date_of_birth is 'Ngày sinh do công nhân cung cấp; chỉ dùng trong hồ sơ cá nhân.';
comment on column public.candidates.preferred_shift is 'Ca làm mong muốn: day, night, rotating, flexible; null là chưa chọn.';
comment on column public.candidates.needs_housing is 'Nhu cầu hỗ trợ nhà ở; null là chưa trả lời, true/false là câu trả lời rõ ràng.';
