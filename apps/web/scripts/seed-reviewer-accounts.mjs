// Tạo tài khoản THẬT cho bên duyệt cửa hàng (Google Play "App access", Apple "Review notes"): một tài khoản cho mỗi vai trò
// (công nhân, nhà tuyển dụng, 5 loại đối tác), đã xác minh sẵn để duyệt viên dùng được mọi chức năng đăng nhập.
// KHÔNG tạo tài khoản Admin (không đưa quyền Admin cho bên duyệt).
//
// Cách chạy (trong thư mục apps/web), mật khẩu do bạn đặt, không ghi vào file:
//   PowerShell:
//     $env:NEXT_PUBLIC_SUPABASE_URL = "https://<ma-du-an>.supabase.co"
//     $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
//     $env:REVIEWER_PASSWORD = "<mat-khau-tu-8-ky-tu>"
//     node scripts/seed-reviewer-accounts.mjs            # chạy thử: chỉ in ra việc sẽ làm, không ghi gì
//     node scripts/seed-reviewer-accounts.mjs --apply    # ghi thật
//   Xong nhớ: Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY, Env:REVIEWER_PASSWORD
//
// Chạy lại được: tài khoản đã có thì bỏ qua, không ghi đè mật khẩu. Hồ sơ đối tác chỉ là hồ sơ mẫu (giấy phép giả "REVIEW-..."),
// dùng riêng cho duyệt cửa hàng; Admin có thể ẩn hoặc xóa sau khi duyệt xong.

import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.REVIEWER_PASSWORD;
if (!url || !key || !password) {
  console.error('Thiếu biến môi trường: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REVIEWER_PASSWORD.');
  process.exit(1);
}
if (password.length < 8) { console.error('REVIEWER_PASSWORD cần từ 8 ký tự.'); process.exit(1); }

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const LICENSE_EVIDENCE = 'https://vieclamcongnhan.com';
const emailOf = name => `reviewer.${name}@vieclamcongnhan.com`;

// Hồ sơ đơn vị: bảng, các cột riêng của từng loại (đủ để qua các kiểm tra khi đặt is_verified = true).
const PROVIDERS = [
  { key: 'training', role: 'training_provider', table: 'training_providers', label: 'Đơn vị đào tạo', extra: { tax_code: '0000000001', license_number: 'REVIEW-TRAINING-001', description: 'Hồ sơ mẫu cho bên duyệt cửa hàng.' } },
  { key: 'rental', role: 'rental_provider', table: 'rental_providers', label: 'Chủ trọ', extra: { address: 'Địa chỉ mẫu', description: 'Hồ sơ mẫu cho bên duyệt cửa hàng.' } },
  { key: 'insurance', role: 'insurance_provider', table: 'insurance_providers', label: 'Đối tác Bảo hiểm', extra: { tax_code: '0000000002', license_number: 'REVIEW-INSURANCE-001', description: 'Hồ sơ mẫu cho bên duyệt cửa hàng.' } },
  { key: 'finance', role: 'finance_provider', table: 'finance_providers', label: 'Đối tác Tài chính', extra: { tax_code: '0000000003', license_number: 'REVIEW-FINANCE-001', license_evidence_url: LICENSE_EVIDENCE, description: 'Hồ sơ mẫu cho bên duyệt cửa hàng.' } },
  { key: 'health', role: 'health_provider', table: 'health_providers', label: 'Cơ sở y tế', extra: { address: 'Địa chỉ mẫu', tax_code: '0000000004', license_number: 'REVIEW-HEALTH-001', license_evidence_url: LICENSE_EVIDENCE, description: 'Hồ sơ mẫu cho bên duyệt cửa hàng.' } },
];

const report = [];
const log = (name, status, note = '') => { report.push({ name, status, note }); console.log(`${status.padEnd(10)} ${name}${note ? ` - ${note}` : ''}`); };

async function userExists({ email, phone }) {
  const q = supabase.from('users').select('id,status');
  const { data, error } = email ? await q.eq('email', email).maybeSingle() : await q.eq('phone', phone).maybeSingle();
  if (error) throw error;
  return data;
}

async function seedWorker(hash) {
  const phone = '0900000001';
  const existing = await userExists({ phone });
  if (existing) return log('Công nhân (SĐT ' + phone + ')', 'BỎ QUA', 'đã tồn tại');
  if (!apply) return log('Công nhân (SĐT ' + phone + ')', 'SẼ TẠO');
  const { data, error } = await supabase.rpc('register_candidate_password_account', { p_phone: phone, p_full_name: 'Công Nhân Duyệt App', p_password_hash: hash });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || row?.created !== true) throw error ?? new Error('Không tạo được tài khoản công nhân (số có thể đã được dùng).');
  const { error: verifyError } = await supabase.from('users').update({ is_verified: true }).eq('id', row.user_id);
  if (verifyError) throw verifyError;
  log('Công nhân (SĐT ' + phone + ')', 'ĐÃ TẠO', 'đã xác minh');
}

async function seedUser(email, role, fullName, hash) {
  const { data, error } = await supabase.from('users')
    .insert({ email, password_hash: hash, full_name: fullName, role, is_verified: true, status: 'active' }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function seedEmployer(hash) {
  const email = emailOf('employer');
  if (await userExists({ email })) return log(`Nhà tuyển dụng (${email})`, 'BỎ QUA', 'đã tồn tại');
  if (!apply) return log(`Nhà tuyển dụng (${email})`, 'SẼ TẠO');
  const userId = await seedUser(email, 'employer', 'Nhà Tuyển Dụng Duyệt App', hash);
  const { error } = await supabase.from('employers').insert({
    user_id: userId, company_name: 'Công ty mẫu (duyệt cửa hàng)', company_slug: `reviewer-employer-${userId.slice(0, 8)}`,
    province_code: 'HCM', tax_code: '0000000000', contact_phone: '0900000002', is_verified: true,
  });
  if (error) throw error;
  log(`Nhà tuyển dụng (${email})`, 'ĐÃ TẠO', 'đã xác minh');
}

async function seedProvider(p, hash) {
  const email = emailOf(p.key);
  if (await userExists({ email })) return log(`${p.label} (${email})`, 'BỎ QUA', 'đã tồn tại');
  if (!apply) return log(`${p.label} (${email})`, 'SẼ TẠO');
  const userId = await seedUser(email, p.role, `${p.label} Duyệt App`, hash);
  const { error } = await supabase.from(p.table).insert({
    user_id: userId, provider_name: `${p.label} mẫu (duyệt cửa hàng)`, provider_slug: `reviewer-${p.key}-${userId.slice(0, 8)}`,
    contact_name: 'Người liên hệ mẫu', contact_phone: '0900000003', province_code: 'HCM', is_verified: true, ...p.extra,
  });
  if (error) { await supabase.from('users').delete().eq('id', userId); throw error; }
  log(`${p.label} (${email})`, 'ĐÃ TẠO', 'đã xác minh');
}

console.log(`${apply ? 'GHI THẬT' : 'CHẠY THỬ (không ghi gì; thêm --apply để ghi)'} -> ${new URL(url).host}\n`);
const hash = await bcrypt.hash(password, 10);
try {
  await seedWorker(hash);
  await seedEmployer(hash);
  for (const p of PROVIDERS) await seedProvider(p, hash);
} catch (error) {
  console.error('\nLỖI:', error?.message || error);
  process.exitCode = 1;
}

console.log('\nĐăng nhập trong app:');
console.log('- Công nhân: số điện thoại 0900000001 + mật khẩu bạn đã đặt');
console.log('- Nhà tuyển dụng và 5 loại đối tác: email trong danh sách trên + mật khẩu bạn đã đặt');
console.log('Mật khẩu không được in ra. Ghi vào "App access" (Google) và "Review notes" (Apple).');
