-- Giảm giới hạn điểm online từ 10 xuống 5 điểm mỗi ngày (yêu cầu techlead, 06/11/2026).
-- Hàm record_candidate_presence đọc daily_points_cap ở mỗi nhịp nên có hiệu lực ngay, không cần đổi hàm.
-- Ngày hôm nay: người đã nhận quá 5 điểm giữ nguyên số đã nhận (không thu hồi), nhưng không được cộng thêm
-- (v_award = greatest(0, v_earned - awarded_points)).

update public.candidate_online_point_settings
set daily_points_cap = 5, updated_at = now()
where id = true;

alter table public.candidate_online_point_settings
  alter column daily_points_cap set default 5;
