// Chạy 1 file .sql (nhiều statement) thẳng vào Postgres qua connection string.
// Dùng cho seed.sql — `supabase db query --file` không hỗ trợ multi-statement
// (lỗi "cannot insert multiple commands into a prepared statement").
// Usage: node scripts/run-sql.mjs <path-to-sql-file>
//test
import { readFileSync } from "node:fs";
import { Client } from "pg";

const [, , sqlPath, connEnvVar = "DATABASE_URL"] = process.argv;
if (!sqlPath) {
  console.error("Usage: node scripts/run-sql.mjs <path-to-sql-file> [ENV_VAR_NAME]");
  process.exit(1);
}

const connectionString = process.env[connEnvVar];
if (!connectionString) {
  console.error(`Missing ${connEnvVar} env var.`);
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log(`✓ Executed ${sqlPath}`);
} catch (err) {
  console.error("✗ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
