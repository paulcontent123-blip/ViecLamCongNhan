import { NextRequest, NextResponse } from "next/server";
import { getKcnList } from "@/lib/kcn";

export async function GET(request: NextRequest) {
  const province = request.nextUrl.searchParams.get("province") ?? undefined;
  const kcn = await getKcnList(province);
  return NextResponse.json({ kcn });
}
