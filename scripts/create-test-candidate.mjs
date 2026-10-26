// Operator-only fixture tool. Uses the existing OTP verification API; no bypass endpoint.
import { createHmac, randomInt } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Client } from 'pg';

class SetupError extends Error {}

const { values } = parseArgs({ options: {
  phone: { type: 'string' },
  'expected-host': { type: 'string' },
  'reissue-for': { type: 'string' },
  'confirm-test-database': { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} });

async function main() {
  if (values.help) {
    console.log('node scripts/create-test-candidate.mjs --phone <10-digit-phone> --expected-host <database-host> --confirm-test-database [--reissue-for <user-id>]');
    console.log('Required environment: CANDIDATE_TEST_DATABASE_URL, CANDIDATE_OTP_SECRET (same as test BE).');
    return;
  }
  const phone = (values.phone || '').replace(/\D/g, '');
  if (!/^0\d{9}$/.test(phone)) throw new SetupError('Supply --phone with a dedicated test phone (10 digits starting with 0).');
  if (!values['confirm-test-database']) throw new SetupError('Confirm the target is a test database with --confirm-test-database.');
  const connectionString = process.env.CANDIDATE_TEST_DATABASE_URL;
  const secret = process.env.CANDIDATE_OTP_SECRET;
  if (!connectionString) throw new SetupError('Missing CANDIDATE_TEST_DATABASE_URL.');
  if (!secret || secret.length < 32) throw new SetupError('CANDIDATE_OTP_SECRET must match test BE and contain at least 32 characters.');
  let target;
  try { target = new URL(connectionString); } catch { throw new SetupError('Invalid test database URL.'); }
  if (!values['expected-host'] || target.hostname !== values['expected-host']) throw new SetupError('Database hostname does not match --expected-host.');
  if (values['reissue-for'] && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values['reissue-for'])) throw new SetupError('Invalid --reissue-for user id.');

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const hash = createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000, query_timeout: 15000 });
  let transaction = false;
  try {
    await client.connect();
    await client.query('begin');
    transaction = true;
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [phone]);
    const { rows: users } = await client.query('select id,role,status from public.users where public.normalize_vn_phone(phone) = $1 for update', [phone]);
    let userId;
    if (values['reissue-for']) {
      if (users.length !== 1 || users[0].id !== values['reissue-for'] || users[0].role !== 'candidate' || users[0].status !== 'active') throw new SetupError('Test candidate identity does not match; no changes made.');
      const { rowCount } = await client.query("select id from public.candidates where user_id = $1 and source = 'test_fixture'", [users[0].id]);
      if (!rowCount) throw new SetupError('Account has no test_fixture profile; refusing to issue a test code.');
      userId = users[0].id;
    } else {
      if (users.length) throw new SetupError('Phone already belongs to an account. Use a fresh test number; existing accounts are not overwritten.');
      const { rowCount } = await client.query('select id from public.candidates where public.normalize_vn_phone(phone) = $1', [phone]);
      if (rowCount) throw new SetupError('Phone has existing candidate records. Use a fresh test number to avoid linking real profiles.');
      const { rows } = await client.query("insert into public.users (phone, full_name, role, status, is_verified) values ($1, 'Công nhân kiểm thử', 'candidate', 'active', true) returning id", [phone]);
      userId = rows[0].id;
      await client.query("insert into public.candidates (user_id, full_name, phone, source) values ($1, 'Công nhân kiểm thử', $2, 'test_fixture')", [userId, phone]);
    }
    // Revoke prior unused codes only for this explicitly selected test account.
    await client.query('update public.candidate_otp_challenges set revoked_at = now() where phone = $1 and consumed_at is null and revoked_at is null', [phone]);
    const { rows: challenges } = await client.query("select public.issue_candidate_otp($1, $2, $3, now() + interval '5 minutes') as id", [phone, hash, `operator-test:${userId}`]);
    if (!challenges[0]?.id) throw new SetupError('OTP rate limit reached. Wait before issuing another code; no changes committed.');
    await client.query('commit');
    transaction = false;
    console.log(JSON.stringify({ userId, phone, code, expiresInSeconds: 300, instructions: 'Development app > Công nhân > enter phone > Nhập mã kiểm thử đã được cấp > enter this one-time code. Do not press Gửi mã qua Zalo.' }, null, 2));
  } finally {
    if (transaction) await client.query('rollback').catch(() => {});
    await client.end().catch(() => {});
  }
}

main().catch(error => {
  // Database/server errors can contain private SQL data. Print only fixed local errors.
  const safeMessage = error instanceof SetupError;
  console.error(safeMessage ? error.message : 'Database operation failed; inspect the test database connection/schema without sharing credentials.');
  process.exitCode = 1;
});

