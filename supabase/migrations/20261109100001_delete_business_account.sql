-- Xóa (ẩn danh hóa) tài khoản nhà tuyển dụng và 5 loại đối tác theo yêu cầu của chính chủ, Admin xác nhận.
-- Dùng lại bảng candidate_deletion_requests (cột user_id tham chiếu users nên dùng được cho mọi vai trò).
-- Chỉ THÊM hàm mới; không đổi bảng hay hàm đang có (delete_candidate_account giữ nguyên cho công nhân).
--
--   Ẩn danh : users (email, số điện thoại, mật khẩu, tên) và hồ sơ doanh nghiệp / đơn vị (tên, liên hệ, mã số thuế, giấy phép,
--             logo, mô tả); số điện thoại, email, tên đơn vị trong "Dịch vụ đã đặt" (service_inquiries) khớp theo số điện thoại.
--   Gỡ công khai : tin tuyển dụng -> closed; khóa học, tin cho thuê, sản phẩm bảo hiểm / tài chính, dịch vụ y tế -> hidden;
--             ảnh tin cho thuê được xóa khỏi dòng dữ liệu (API dọn file trên Cloudinary sau khi hàm thành công).
--   Giữ lại : lịch sử đơn hàng và thanh toán (kế toán, đối soát; đơn đang chờ thanh toán chuyển sang cancelled), hồ sơ ứng viên
--             và yêu cầu của công nhân đã gửi tới đơn vị (là dữ liệu của công nhân). Dòng users và dòng hồ sơ vẫn còn để các
--             khóa ngoại (đơn hàng, lượt xem liên hệ) giữ nguyên, nhưng không còn thông tin nhận diện.
-- Giải phóng email và số điện thoại để có thể đăng ký lại. Hàm lặp lại an toàn (đã xóa rồi thì trả true).

create or replace function public.delete_business_account(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_pid uuid;
  v_contact text;
  v_keys text[];
begin
  select * into v_user from public.users where id = p_user_id for update;
  if not found then return false; end if;
  if v_user.role not in ('employer', 'training_provider', 'rental_provider', 'insurance_provider', 'finance_provider', 'health_provider') then
    return false;
  end if;
  if v_user.status = 'deleted' then return true; end if;

  if v_user.role = 'employer' then
    select id, contact_phone into v_pid, v_contact from public.employers where user_id = p_user_id for update;
    if v_pid is not null then
      update public.jobs set status = 'closed' where employer_id = v_pid and status <> 'closed';
      update public.orders set status = 'cancelled' where employer_id = v_pid and status = 'pending';
      update public.employers
        set company_name = 'Doanh nghiệp đã xóa', company_slug = 'da-xoa-' || id::text, company_logo_url = null,
            tax_code = null, contact_phone = '', industry = null, province_code = null, is_verified = false
        where id = v_pid;
    end if;

  elsif v_user.role = 'training_provider' then
    select id, contact_phone into v_pid, v_contact from public.training_providers where user_id = p_user_id for update;
    if v_pid is not null then
      update public.vocational_courses set status = 'hidden' where provider_id = v_pid and status <> 'hidden';
      update public.orders set status = 'cancelled' where training_provider_id = v_pid and status = 'pending';
      update public.training_providers
        set provider_name = 'Đơn vị đã xóa', provider_slug = 'da-xoa-' || id::text, contact_name = 'Đã xóa', contact_phone = '',
            province_code = null, tax_code = null, license_number = null, description = null, logo_url = null, is_verified = false
        where id = v_pid;
    end if;

  elsif v_user.role = 'rental_provider' then
    select id, contact_phone into v_pid, v_contact from public.rental_providers where user_id = p_user_id for update;
    if v_pid is not null then
      update public.rental_listings set status = 'hidden' where provider_id = v_pid and status <> 'hidden';
      update public.rental_listings set photo_urls = '{}' where provider_id = v_pid and photo_urls <> '{}';
      update public.orders set status = 'cancelled' where rental_provider_id = v_pid and status = 'pending';
      update public.rental_providers
        set provider_name = 'Đơn vị đã xóa', provider_slug = 'da-xoa-' || id::text, contact_name = 'Đã xóa', contact_phone = '',
            province_code = null, address = null, description = null, is_verified = false
        where id = v_pid;
    end if;

  elsif v_user.role = 'insurance_provider' then
    select id, contact_phone into v_pid, v_contact from public.insurance_providers where user_id = p_user_id for update;
    if v_pid is not null then
      update public.insurance_products set status = 'hidden' where provider_id = v_pid and status <> 'hidden';
      update public.orders set status = 'cancelled' where insurance_provider_id = v_pid and status = 'pending';
      update public.insurance_providers
        set provider_name = 'Đơn vị đã xóa', provider_slug = 'da-xoa-' || id::text, contact_name = 'Đã xóa', contact_phone = '',
            province_code = null, tax_code = null, license_number = null, description = null, logo_url = null, is_verified = false
        where id = v_pid;
    end if;

  elsif v_user.role = 'finance_provider' then
    select id, contact_phone into v_pid, v_contact from public.finance_providers where user_id = p_user_id for update;
    if v_pid is not null then
      update public.finance_products set status = 'hidden' where provider_id = v_pid and status <> 'hidden';
      update public.orders set status = 'cancelled' where finance_provider_id = v_pid and status = 'pending';
      update public.finance_providers
        set provider_name = 'Đơn vị đã xóa', provider_slug = 'da-xoa-' || id::text, contact_name = 'Đã xóa', contact_phone = '',
            province_code = null, tax_code = null, license_number = null, license_evidence_url = null, description = null,
            logo_url = null, is_verified = false
        where id = v_pid;
    end if;

  elsif v_user.role = 'health_provider' then
    select id, contact_phone into v_pid, v_contact from public.health_providers where user_id = p_user_id for update;
    if v_pid is not null then
      update public.health_services set status = 'hidden' where provider_id = v_pid and status <> 'hidden';
      update public.health_providers
        set provider_name = 'Đơn vị đã xóa', provider_slug = 'da-xoa-' || id::text, contact_name = 'Đã xóa', contact_phone = '',
            province_code = null, address = null, tax_code = null, license_number = null, license_evidence_url = null,
            description = null, logo_url = null, is_verified = false
        where id = v_pid;
    end if;
  end if;

  -- "Dịch vụ đã đặt": yêu cầu tư vấn khớp theo số điện thoại của tài khoản hoặc của đơn vị. Giữ lại nội dung yêu cầu cho Admin,
  -- chỉ bỏ thông tin nhận diện.
  v_keys := array_remove(array[
    nullif(public.normalize_vn_phone(v_contact), ''),
    nullif(public.normalize_vn_phone(v_user.phone), '')
  ], null);
  if coalesce(array_length(v_keys, 1), 0) > 0 then
    update public.service_inquiries
      set company_name = 'Đã xóa', phone = '', email = '', phone_normalized = null
      where phone_normalized = any(v_keys);
  end if;

  update public.users
    set status = 'deleted', is_verified = false, email = null, phone = null, password_hash = null,
        full_name = 'Tài khoản đã xóa', password_changed_at = now()
    where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.delete_business_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_business_account(uuid) to service_role;

comment on function public.delete_business_account(uuid) is
  'Ẩn danh hóa tài khoản nhà tuyển dụng / đối tác theo yêu cầu đã được Admin xác nhận. Giữ lịch sử đơn hàng; không xóa dòng users và dòng hồ sơ.';
