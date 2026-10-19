import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ loggedIn: false });
  const { data: user } = await createSupabaseAdminClient().from("users")
    .select("full_name,phone").eq("id", session.userId).maybeSingle();
  return NextResponse.json({ loggedIn: true, candidate: { phone: session.phone, fullName: user?.full_name || "Công nhân" } });
}
