import { NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";

// Đọc qua API thay vì đọc cookie trực tiếp trong root layout (Server Component):
// nếu layout gốc gọi cookies(), TOÀN BỘ site (kể cả các trang tĩnh như
// /tuyen-dung, /dich-vu-tron-goi...) sẽ bị ép thành dynamic rendering, mất tối
// ưu static generation. Navbar gọi endpoint này 1 lần khi mount thay thế.
export async function GET() {
  const session = await getEmployerSession();
  if (!session) return NextResponse.json({ loggedIn: false });
  return NextResponse.json({ loggedIn: true, companyName: session.companyName });
}
