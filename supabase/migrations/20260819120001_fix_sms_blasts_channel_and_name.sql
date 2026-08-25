-- Fix: constraint gốc chỉ cho phép channel in ('sms','zalo','both') nhưng toàn bộ
-- code (BLAST_CHANNEL_RATES, BlastTab, createEmployerBlast) dùng giá trị 'combo' cho
-- lựa chọn "Combo SMS+Zalo" — insert với channel='combo' sẽ luôn vi phạm constraint
-- và fail. Đổi constraint sang khớp giá trị app đang dùng thay vì sửa ngược code.
alter table public.sms_blasts drop constraint sms_blasts_channel_check;
alter table public.sms_blasts add constraint sms_blasts_channel_check
  check (channel in ('sms', 'zalo', 'combo'));

-- Tên chiến dịch NTD nhập ở form (VD: "Tuyển gấp 300 CN may Bình Dương tháng 9")
-- trước đây bị bỏ qua hoàn toàn, không có cột nào lưu — Admin không có cách nào biết
-- tên chiến dịch khi xem danh sách Blast.
alter table public.sms_blasts add column if not exists campaign_name text;

-- Bảng gốc thiếu created_at (khác mọi bảng còn lại trong schema) — không sắp xếp
-- được theo thời gian tạo ở trang quản trị lẫn lịch sử của NTD.
alter table public.sms_blasts add column if not exists created_at timestamptz not null default now();
