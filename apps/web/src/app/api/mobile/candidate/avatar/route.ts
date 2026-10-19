import { NextRequest, NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteImageFromCloudinary, uploadImageToCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isOwnedAvatar(url: string, userId: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "res.cloudinary.com" && parsed.pathname.includes(`/candidate-avatars/${userId}/`);
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { data, error } = await createSupabaseAdminClient()
    .from("candidates")
    .select("avatar_url")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Không tải được ảnh đại diện." }, { status: 500 });
  return NextResponse.json({ ok: true, avatarUrl: data?.avatar_url ?? null });
}

export async function POST(request: NextRequest) {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh đại diện." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ảnh phải có dung lượng từ 1 byte đến 5MB." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: candidates, error: readError } = await supabase
    .from("candidates")
    .select("id,avatar_url")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (readError) return NextResponse.json({ error: "Không tải được hồ sơ công nhân." }, { status: 500 });

  const current = candidates?.[0] ?? null;
  let avatarUrl: string;
  try {
    avatarUrl = await uploadImageToCloudinary(file, `candidate-avatars/${session.userId}`);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tải ảnh đại diện lên thất bại." },
      { status: 502 },
    );
  }

  let saveError: string | null = null;
  if (current) {
    const { error } = await supabase.from("candidates")
      .update({ avatar_url: avatarUrl })
      .eq("id", current.id)
      .eq("user_id", session.userId);
    saveError = error?.message ?? null;
  } else {
    const { data: user, error: userError } = await supabase.from("users")
      .select("full_name")
      .eq("id", session.userId)
      .maybeSingle();
    if (userError || !user) saveError = "Không tìm thấy tài khoản công nhân.";
    else {
      const { error } = await supabase.from("candidates").insert({
        user_id: session.userId,
        full_name: user.full_name || "Công nhân",
        phone: session.phone,
        source: "worker_profile",
        avatar_url: avatarUrl,
      });
      saveError = error?.message ?? null;
    }
  }

  if (saveError) {
    await deleteImageFromCloudinary(avatarUrl).catch(() => undefined);
    return NextResponse.json({ error: "Không lưu được ảnh đại diện vào hồ sơ." }, { status: 500 });
  }

  if (current?.avatar_url && isOwnedAvatar(current.avatar_url, session.userId)) {
    await deleteImageFromCloudinary(current.avatar_url).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, avatarUrl });
}
