import { NextResponse } from "next/server";
import { CANDIDATE_SESSION_COOKIE } from "@/lib/candidate-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CANDIDATE_SESSION_COOKIE);
  return response;
}
