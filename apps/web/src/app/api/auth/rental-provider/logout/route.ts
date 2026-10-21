import { NextResponse } from "next/server";
import { RENTAL_PROVIDER_SESSION_COOKIE } from "@/lib/rental-provider-session";
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(RENTAL_PROVIDER_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
