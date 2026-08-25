import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";

// Cùng lý do với /api/auth/employer/me: Navbar (client) gọi qua API thay vì
// đọc cookie trực tiếp trong root layout, để tránh ép toàn site render động.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ loggedIn: false });
  return NextResponse.json({ loggedIn: true, fullName: session.fullName });
}
