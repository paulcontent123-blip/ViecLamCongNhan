-- Cho phép NTD/ứng viên tự gõ "Ngành nghề khác" thay vì chỉ chọn trong danh sách cố
-- định JOB_INDUSTRIES/EMPLOYER_INDUSTRIES (xem lib/industries.ts) — jobs.industry và
-- candidates.desired_industry vốn đã là free text (không constraint), chỉ
-- employers.industry còn CHECK enum 5 giá trị nên phải bỏ để đồng nhất.
alter table public.employers drop constraint if exists employers_industry_check;

-- Chuẩn hoá so khớp ngành nghề không phân biệt hoa/thường, có dấu hay không dấu (VD:
-- "May Mặc" = "may mac" = "MAY MAC") — cần cho lọc tin (Tìm việc), lọc ứng viên, và
-- đặc biệt tính năng auto-blast Zalo (runCampaignAutoBlast) so khớp jobs.industry với
-- candidates.desired_industry, dễ bỏ sót nếu 1 bên NTD/ứng viên gõ khác chính tả.
-- unaccent() mặc định là STABLE (phụ thuộc search_path), không dùng được trong cột
-- generated (yêu cầu IMMUTABLE) — bọc lại 1 hàm immutable trỏ cứng vào dictionary.
create extension if not exists unaccent with schema extensions;

create or replace function public.text_search_key(input text)
returns text
language sql
immutable
parallel safe
set search_path = extensions, public
as $$
  select lower(unaccent(coalesce(input, '')));
$$;

alter table public.jobs add column if not exists industry_key text
  generated always as (public.text_search_key(industry)) stored;
create index if not exists jobs_industry_key_idx on public.jobs (industry_key);

alter table public.candidates add column if not exists desired_industry_key text
  generated always as (public.text_search_key(desired_industry)) stored;
create index if not exists candidates_desired_industry_key_idx on public.candidates (desired_industry_key);

comment on function public.text_search_key(text) is 'Chuẩn hoá text để so khớp không phân biệt hoa/thường + không dấu — dùng cho các cột *_key (xem industry_key, desired_industry_key). Kết quả PHẢI khớp normalizeIndustryText() ở apps/web/src/lib/industries.ts.';
