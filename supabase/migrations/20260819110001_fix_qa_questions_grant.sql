-- Fix: RLS policy "qa_questions_public_read_published" lọc theo cột status
-- (using (status = 'published')), nhưng migration trước chỉ grant SELECT cho
-- (id, question, answer, sort_order, created_at) — thiếu cột status. Postgres cần
-- quyền SELECT trên MỌI cột được policy USING tham chiếu tới để đánh giá điều kiện,
-- kể cả khi cột đó không nằm trong danh sách cột client được đọc kết quả. Thiếu
-- quyền này khiến mọi SELECT (kể cả đúng cột được phép) trả lỗi "permission denied
-- for table qa_questions" thay vì lọc dòng bình thường.
grant select (status) on public.qa_questions to anon, authenticated;
