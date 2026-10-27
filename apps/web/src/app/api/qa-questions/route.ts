import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { analyzeQuestion, contactKey, contactKind, normalizeQuestionText } from "@/lib/spam-guard";
import { clientIp, consumeAll, tooManyRequests } from "@/lib/rate-limit";

const bodySchema = z.object({
  question: z.string().trim().min(10, "Câu hỏi tối thiểu 10 ký tự"),
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
  contact: z.string().trim().min(6, "Vui lòng nhập SĐT hoặc email để VEA Law liên hệ lại").max(254),
  // Ô bẫy cho bot: người dùng thật không thấy nên không điền. Có giá trị thì coi là bot và bỏ qua âm thầm.
  website: z.string().max(200).optional(),
});

const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400, headers });
  }
  const { question, fullName, contact, website } = parsed.data;

  // Bot điền ô bẫy: trả thành công giả, không ghi dữ liệu và không tiêu hao hạn mức.
  if (website && website.trim()) return NextResponse.json({ ok: true }, { headers });

  if (!contactKind(contact)) {
    return NextResponse.json({ error: "Số điện thoại hoặc email chưa hợp lệ." }, { status: 400, headers });
  }
  const verdict = analyzeQuestion(question);
  if (!verdict.ok) return NextResponse.json({ error: verdict.message, reason: verdict.reason }, { status: 400, headers });

  const supabase = createSupabaseAdminClient();
  const key = contactKey(contact);
  const fingerprint = createHash("sha256").update(`${key}|${normalizeQuestionText(question)}`).digest("hex");

  // Trùng nội dung trong 24 giờ: từ chối trước khi tính hạn mức để người dùng không mất lượt vì gửi nhầm hai lần.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: duplicate } = await supabase.from("qa_questions").select("id").eq("question_fingerprint", fingerprint).gte("created_at", since).limit(1);
  if (duplicate && duplicate.length > 0) {
    return NextResponse.json({ error: "Bạn đã gửi câu hỏi này rồi. Đội ngũ sẽ phản hồi qua thông tin liên hệ bạn cung cấp.", reason: "duplicate" }, { status: 409, headers });
  }

  const limit = await consumeAll([
    { scope: "qa:burst", key, limit: 1, windowSeconds: 60 },
    { scope: "qa:contact-hour", key, limit: 3, windowSeconds: 3600 },
    { scope: "qa:contact-day", key, limit: 6, windowSeconds: 86400 },
    { scope: "qa:ip-hour", key: clientIp(request), limit: 8, windowSeconds: 3600 },
    { scope: "qa:ip-day", key: clientIp(request), limit: 30, windowSeconds: 86400 },
  ]);
  if (!limit.allowed) return tooManyRequests("Bạn đã gửi quá nhiều câu hỏi trong thời gian ngắn.", limit.retryAfterSeconds);

  const row = { question, full_name: fullName || null, contact, status: "new" };
  let { error } = await supabase.from("qa_questions").insert({ ...row, question_fingerprint: fingerprint });
  // Chưa áp migration (thiếu cột question_fingerprint): vẫn lưu câu hỏi, chỉ mất khả năng chặn trùng.
  if (error && (error.code === "42703" || error.code === "PGRST204")) ({ error } = await supabase.from("qa_questions").insert(row));
  if (error) return NextResponse.json({ error: "Không gửi được câu hỏi, thử lại sau." }, { status: 500, headers });

  return NextResponse.json({ ok: true }, { headers });
}
