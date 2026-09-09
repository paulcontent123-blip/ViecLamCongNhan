-- Nâng cấp trình soạn bài viết ở trang Quản trị: nội dung HTML có định dạng
-- (đậm/nghiêng/heading/list/bảng/ảnh/quote), ảnh đại diện, mô tả SEO, mục lục và tác giả.
-- content_format giữ bài cũ (soạn bằng textarea) render đúng như trước: 'text' = xuống
-- dòng thuần, 'html' = nội dung đã được sanitize server-side trước khi ghi.

alter table public.articles
  add column if not exists content_format text not null default 'text',
  add column if not exists seo_description text,
  add column if not exists cover_image_url text,
  add column if not exists author_name text,
  add column if not exists show_toc boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_content_format_check'
  ) then
    alter table public.articles
      add constraint articles_content_format_check check (content_format in ('text', 'html'));
  end if;
end $$;
