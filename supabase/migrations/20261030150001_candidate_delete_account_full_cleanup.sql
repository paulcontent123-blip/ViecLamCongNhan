-- Xóa tài khoản công nhân đầy đủ (thay thế hàm của 20261030140001).
-- Chặn xóa khi còn yêu cầu đổi quà đang xử lý; xóa hoặc gỡ liên kết dữ liệu cá nhân ở mọi chức năng;
-- giải phóng số điện thoại để có thể đăng ký lại. Giữ lại sổ điểm và trạng thái yêu cầu quà để đối soát.
--   Xóa hẳn : hồ sơ + đơn ứng tuyển, tin và hội thoại Chợ đồ cũ, đồng ý chia sẻ hồ sơ, tùy chọn gợi ý, bộ đếm điểm online,
--             thông tin nhận quà (delivery_info).
--   Gỡ liên kết (giữ nội dung đối tác đã nhận): yêu cầu tư vấn và đăng ký gửi đối tác (user_id -> null).
--   Ẩn danh : users (tên, số điện thoại, mật khẩu); dòng users vẫn còn vì sổ điểm tham chiếu.
-- Ảnh trên Cloudinary do API xóa sau khi hàm này thành công.
create or replace function public.delete_candidate_account(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.users%rowtype;
begin
  -- Cùng khóa với request_candidate_reward_redemption để không có yêu cầu mới chen vào giữa lúc kiểm tra và xóa.
  perform pg_advisory_xact_lock(hashtextextended('candidate-reward:' || p_user_id::text, 0));
  select * into v_user from public.users where id = p_user_id for update;
  if not found or v_user.role <> 'candidate' then return false; end if;
  if v_user.status = 'deleted' then return false; end if;

  if exists (
    select 1 from public.candidate_reward_redemptions
    where user_id = p_user_id and status in ('pending', 'approved')
  ) then
    raise exception using errcode = 'P0001', message = 'CANDIDATE_HAS_OPEN_REDEMPTIONS';
  end if;

  update public.jobs j set apply_count = greatest(0, j.apply_count - counts.application_count)
    from (
      select a.job_id, count(*)::integer as application_count
      from public.applications a
      join public.candidates c on c.id = a.candidate_id
      where c.user_id = p_user_id and a.job_id is not null
      group by a.job_id
    ) counts
    where j.id = counts.job_id;

  -- Chợ đồ cũ: xóa hội thoại liên quan (người mua hoặc người bán), rồi xóa tin của người này.
  delete from public.secondhand_marketplace_inquiries
    where seller_user_id = p_user_id or buyer_user_id = p_user_id;
  delete from public.secondhand_marketplace_listings where seller_user_id = p_user_id;

  delete from public.candidates where user_id = p_user_id;
  delete from public.candidate_training_visibility_consents where user_id = p_user_id;
  delete from public.candidate_rental_visibility_consents where user_id = p_user_id;
  delete from public.candidate_match_preferences where user_id = p_user_id;
  delete from public.candidate_online_daily where user_id = p_user_id;

  -- Yêu cầu gửi đối tác: giữ nội dung đối tác đã nhận nhưng không còn gắn với tài khoản.
  update public.vocational_inquiries set user_id = null where user_id = p_user_id;
  update public.vocational_applications set user_id = null where user_id = p_user_id;
  update public.rental_inquiries set user_id = null where user_id = p_user_id;
  update public.insurance_inquiries set user_id = null where user_id = p_user_id;
  update public.finance_inquiries set user_id = null where user_id = p_user_id;
  update public.health_inquiries set user_id = null where user_id = p_user_id;

  -- Mã OTP còn lưu số điện thoại rõ; câu hỏi Hỏi đáp có thể để lại tên và liên hệ riêng của người hỏi (nội dung câu hỏi giữ nguyên).
  if v_user.phone is not null then
    delete from public.candidate_otp_challenges
      where public.normalize_vn_phone(phone) = public.normalize_vn_phone(v_user.phone);
    update public.qa_questions set full_name = null, contact = null
      where contact is not null
        and public.normalize_vn_phone(contact) = public.normalize_vn_phone(v_user.phone);
  end if;

  update public.candidate_reward_redemptions set delivery_info = null
    where user_id = p_user_id and delivery_info is not null;

  update public.users
    set status = 'deleted', is_verified = false, phone = null, password_hash = null, full_name = 'Tài khoản đã xóa'
    where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.delete_candidate_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_candidate_account(uuid) to service_role;
