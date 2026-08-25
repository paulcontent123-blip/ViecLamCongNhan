import type { AdminQARow } from "@/lib/admin";
import { QARow } from "@/components/admin/QARow";

export function QAManagement({
  questions,
  total,
  newCount,
}: {
  questions: AdminQARow[];
  total: number;
  newCount: number;
}) {
  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">❓ Hỏi đáp</h1>
      <p className="mb-5 text-[13px] text-brand-navy/50">
        Câu hỏi NLĐ gửi từ form Hỏi đáp ({total.toLocaleString("vi-VN")}
        {newCount > 0 ? ` · ${newCount} câu hỏi mới chưa trả lời` : ""}). Trả lời rồi &ldquo;Duyệt &amp; đăng
        công khai&rdquo; để hiện vào FAQ ở trang Hỏi đáp — thông tin liên hệ chỉ Admin nhìn thấy.
      </p>

      {questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Chưa có câu hỏi nào được gửi.
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => (
            <QARow key={question.id} question={question} />
          ))}
        </div>
      )}
    </div>
  );
}
