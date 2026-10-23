import { NextResponse } from "next/server";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
export async function GET() { const session = await getHealthProviderSession(); return NextResponse.json({ loggedIn: !!session, ...(session ? { provider: { id: session.providerId, providerName: session.providerName } } : {}) }, { headers: { "Cache-Control": "private, no-store" } }); }
