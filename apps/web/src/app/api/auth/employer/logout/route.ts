import { NextResponse } from "next/server";
import { EMPLOYER_SESSION_COOKIE } from "@/lib/employer-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(EMPLOYER_SESSION_COOKIE);
  return response;
}
