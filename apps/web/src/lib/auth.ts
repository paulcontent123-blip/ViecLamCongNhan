import "server-only";
import bcrypt from "bcryptjs";

// Chỉ dùng trong Route Handlers/Server Actions (Node runtime).
// KHÔNG import file này trong middleware.ts ‑ bcryptjs không chạy được trên
// Edge Runtime. Session/JWT (Edge-safe) nằm ở lib/admin-session.ts.

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
