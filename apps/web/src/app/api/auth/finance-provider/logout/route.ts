import { NextResponse } from "next/server";
import { FINANCE_PROVIDER_SESSION_COOKIE } from "@/lib/finance-provider-session";
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(FINANCE_PROVIDER_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
