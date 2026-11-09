-- Tạo tài khoản THẬT cho bên duyệt cửa hàng (Google Play "App access", Apple "Review notes"): một tài khoản cho mỗi vai trò
-- (công nhân, nhà tuyển dụng, 5 loại đối tác), đã xác minh sẵn. KHÔNG tạo tài khoản Admin.
-- Bản SQL của kịch bản apps/web/scripts/seed-reviewer-accounts.mjs, dùng khi không có khóa service role trên máy.
--
-- File này KHÔNG nằm trong supabase/migrations nên không tự chạy khi `npm run db:migrate`.
-- Cách dùng trong Supabase SQL Editor:
--   1. Sửa dòng v_password bên dưới thành mật khẩu bạn chọn (từ 8 ký tự). KHÔNG lưu mật khẩu thật vào file rồi commit.
--   2. Chạy cả file với v_apply := false (mặc định): chạy thử. Thành công sẽ hiện thông báo "CHẠY THỬ XONG..." (là một
--      thông báo lỗi có chủ ý để hoàn tác mọi thứ, chưa ghi gì). Nếu hiện lỗi khác thì đó là lỗi thật cần sửa.
--   3. Thấy ổn thì đổi v_apply thành true rồi chạy lại: ghi thật và hiện bảng 7 tài khoản.
--   4. Xong đổi lại mật khẩu trong file về chỗ giữ chỗ (đừng để mật khẩu thật trong file).
-- Chạy lại được: tài khoản đã có thì bỏ qua, không ghi đè mật khẩu.
-- Đăng nhập: công nhân bằng số điện thoại v_worker_phone (mặc định 0900000001); các vai trò khác bằng email reviewer.<vai trò>@vieclamcongnhan.com
--            (employer, training, rental, insurance, finance, health).

do $$
declare
  v_apply boolean := true;  -- false = chạy thử (hoàn tác), true = ghi thật
  v_worker_phone text := '0900000001';  -- số điện thoại tài khoản công nhân mẫu (10 số, chưa ai dùng); đổi nếu báo đã bị dùng
  v_password text := 'ĐẶT_MẬT_KHẨU_Ở_ĐÂY';
  v_hash text;
  v_user_id uuid;
  v_row record;
  v_email text;
begin
  if v_password = 'ĐẶT_MẬT_KHẨU_Ở_ĐÂY' or length(v_password) < 8 then
    raise exception 'Hãy sửa v_password thành mật khẩu thật (từ 8 ký tự) trước khi chạy.';
  end if;
  -- bcrypt cost 10, tương thích bcryptjs mà web dùng để kiểm tra mật khẩu.
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf', 10));

  -- 1) Công nhân: dùng đúng hàm đăng ký của web (tạo users + candidates), rồi đánh dấu đã xác minh.
  if exists (select 1 from public.users where phone = v_worker_phone and role = 'candidate') then
    null;  -- đã có tài khoản công nhân mẫu từ lần chạy trước: bỏ qua
  else
    if exists (select 1 from public.users where public.normalize_vn_phone(phone) = v_worker_phone)
       or exists (select 1 from public.candidates where public.normalize_vn_phone(phone) = v_worker_phone) then
      raise exception 'Số % đã được dùng bởi tài khoản hoặc hồ sơ ứng viên khác. Hãy đổi v_worker_phone sang số khác (10 số, bắt đầu bằng 0, chưa ai dùng).', v_worker_phone;
    end if;
    select * into v_row from public.register_candidate_password_account(v_worker_phone, 'Công Nhân Duyệt App', v_hash);
    if v_row.created is not true then
      raise exception 'Hàm đăng ký công nhân từ chối số % (kiểm tra số gồm đúng 10 chữ số, bắt đầu bằng 0).', v_worker_phone;
    end if;
    update public.users set is_verified = true where id = v_row.user_id;
  end if;

  -- 2) Nhà tuyển dụng
  v_email := 'reviewer.employer@vieclamcongnhan.com';
  if not exists (select 1 from public.users where email = v_email) then
    insert into public.users(email, password_hash, full_name, role, is_verified, status)
      values (v_email, v_hash, 'Nhà Tuyển Dụng Duyệt App', 'employer', true, 'active') returning id into v_user_id;
    insert into public.employers(user_id, company_name, company_slug, province_code, tax_code, contact_phone, is_verified)
      values (v_user_id, 'Công ty mẫu (duyệt cửa hàng)', 'reviewer-employer-' || left(v_user_id::text, 8), 'HCM', '0000000000', '0900000002', true);
  end if;

  -- 3) Đối tác Đào tạo
  v_email := 'reviewer.training@vieclamcongnhan.com';
  if not exists (select 1 from public.users where email = v_email) then
    insert into public.users(email, password_hash, full_name, role, is_verified, status)
      values (v_email, v_hash, 'Đơn vị đào tạo Duyệt App', 'training_provider', true, 'active') returning id into v_user_id;
    insert into public.training_providers(user_id, provider_name, provider_slug, contact_name, contact_phone, province_code,
                                          is_verified, tax_code, license_number, description)
      values (v_user_id, 'Đơn vị đào tạo mẫu (duyệt cửa hàng)', 'reviewer-training-' || left(v_user_id::text, 8), 'Người liên hệ mẫu',
              '0900000003', 'HCM', true, '0000000001', 'REVIEW-TRAINING-001', 'Hồ sơ mẫu cho bên duyệt cửa hàng.');
  end if;

  -- 4) Chủ trọ
  v_email := 'reviewer.rental@vieclamcongnhan.com';
  if not exists (select 1 from public.users where email = v_email) then
    insert into public.users(email, password_hash, full_name, role, is_verified, status)
      values (v_email, v_hash, 'Chủ trọ Duyệt App', 'rental_provider', true, 'active') returning id into v_user_id;
    insert into public.rental_providers(user_id, provider_name, provider_slug, contact_name, contact_phone, province_code,
                                        is_verified, address, description)
      values (v_user_id, 'Chủ trọ mẫu (duyệt cửa hàng)', 'reviewer-rental-' || left(v_user_id::text, 8), 'Người liên hệ mẫu',
              '0900000003', 'HCM', true, 'Địa chỉ mẫu', 'Hồ sơ mẫu cho bên duyệt cửa hàng.');
  end if;

  -- 5) Đối tác Bảo hiểm
  v_email := 'reviewer.insurance@vieclamcongnhan.com';
  if not exists (select 1 from public.users where email = v_email) then
    insert into public.users(email, password_hash, full_name, role, is_verified, status)
      values (v_email, v_hash, 'Đối tác Bảo hiểm Duyệt App', 'insurance_provider', true, 'active') returning id into v_user_id;
    insert into public.insurance_providers(user_id, provider_name, provider_slug, contact_name, contact_phone, province_code,
                                           is_verified, tax_code, license_number, description)
      values (v_user_id, 'Đối tác Bảo hiểm mẫu (duyệt cửa hàng)', 'reviewer-insurance-' || left(v_user_id::text, 8), 'Người liên hệ mẫu',
              '0900000003', 'HCM', true, '0000000002', 'REVIEW-INSURANCE-001', 'Hồ sơ mẫu cho bên duyệt cửa hàng.');
  end if;

  -- 6) Đối tác Tài chính
  v_email := 'reviewer.finance@vieclamcongnhan.com';
  if not exists (select 1 from public.users where email = v_email) then
    insert into public.users(email, password_hash, full_name, role, is_verified, status)
      values (v_email, v_hash, 'Đối tác Tài chính Duyệt App', 'finance_provider', true, 'active') returning id into v_user_id;
    insert into public.finance_providers(user_id, provider_name, provider_slug, contact_name, contact_phone, province_code,
                                         is_verified, tax_code, license_number, license_evidence_url, description)
      values (v_user_id, 'Đối tác Tài chính mẫu (duyệt cửa hàng)', 'reviewer-finance-' || left(v_user_id::text, 8), 'Người liên hệ mẫu',
              '0900000003', 'HCM', true, '0000000003', 'REVIEW-FINANCE-001', 'https://vieclamcongnhan.com', 'Hồ sơ mẫu cho bên duyệt cửa hàng.');
  end if;

  -- 7) Cơ sở y tế
  v_email := 'reviewer.health@vieclamcongnhan.com';
  if not exists (select 1 from public.users where email = v_email) then
    insert into public.users(email, password_hash, full_name, role, is_verified, status)
      values (v_email, v_hash, 'Cơ sở y tế Duyệt App', 'health_provider', true, 'active') returning id into v_user_id;
    insert into public.health_providers(user_id, provider_name, provider_slug, contact_name, contact_phone, province_code,
                                        is_verified, address, tax_code, license_number, license_evidence_url, description)
      values (v_user_id, 'Cơ sở y tế mẫu (duyệt cửa hàng)', 'reviewer-health-' || left(v_user_id::text, 8), 'Người liên hệ mẫu',
              '0900000003', 'HCM', true, 'Địa chỉ mẫu', '0000000004', 'REVIEW-HEALTH-001', 'https://vieclamcongnhan.com', 'Hồ sơ mẫu cho bên duyệt cửa hàng.');
  end if;

  if not v_apply then
    raise exception 'CHẠY THỬ XONG: không có lỗi, chưa ghi gì vào database. Đổi v_apply thành true rồi chạy lại để ghi thật.';
  end if;
end
$$;

-- Kết quả: danh sách tài khoản mẫu (không hiện mật khẩu). Đủ 7 dòng là đúng.
select u.role, coalesce(u.email, u.phone) as dang_nhap_bang, u.is_verified, u.status
from public.users u
where u.email like 'reviewer.%@vieclamcongnhan.com' or u.phone = '0900000001' or u.full_name = 'Công Nhân Duyệt App'
order by u.role;
