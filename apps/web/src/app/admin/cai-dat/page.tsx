export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="mb-4 text-[16px] font-extrabold text-brand-navy">⚙️ Cài đặt hệ thống</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[13.5px] font-bold text-brand-navy">Thông tin website</div>
          <label className="mb-2.5 block text-[12px] font-semibold text-brand-navy/60">
            Tên website
            <input
              defaultValue="ViecLamCongNhan.com"
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-brand-orange"
            />
          </label>
          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Email hỗ trợ
            <input
              defaultValue="support@vieclamcongnhan.com"
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-brand-orange"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[13.5px] font-bold text-brand-navy">Tích hợp SMS / Zalo</div>
          <label className="mb-2.5 block text-[12px] font-semibold text-brand-navy/60">
            ESMS API Key
            <input
              type="password"
              placeholder="esms_..."
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-brand-orange"
            />
          </label>
          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Zalo OA Token
            <input
              type="password"
              placeholder="zoa_token_..."
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-brand-orange"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-black/10 bg-white px-4 py-3 text-[12.5px] text-brand-navy/50">
        ⚠️ Trang này chưa nối cơ sở dữ liệu (cần bảng <code className="rounded bg-black/5 px-1 py-0.5">settings</code> —
        hiện chưa có trong schema Supabase). Cấu hình thật hiện đọc từ biến môi trường trên server.
      </div>
    </div>
  );
}
