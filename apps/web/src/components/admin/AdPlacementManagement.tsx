"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { adImageHint, adImageSizeError } from "@/lib/ad-image";
import { AD_MAX_KCN, adCreateSchema, adToday, type AdPlacement } from "@/lib/ads";

export interface AdminAdItem {
  id: string;
  placement: AdPlacement;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  is_hot: boolean;
  kcn_ids: string[];
  show_on_web: boolean;
  show_on_app: boolean;
  starts_on: string;
  ends_on: string;
  status: "active" | "paused";
  customer_note: string | null;
}
export interface KcnOption { id: string; label: string }

const PLACEMENTS: { value: AdPlacement; label: string }[] = [
  { value: "homepage_banner", label: "Banner trang chủ" },
  { value: "sidebar", label: "Sidebar (chỉ web)" },
  { value: "kcn_banner", label: "Banner KCN / Bundle 5 KCN" },
  { value: "service_card", label: "Card nhà trọ/dịch vụ" },
];
const PLACEMENT_LABEL = Object.fromEntries(PLACEMENTS.map((item) => [item.value, item.label])) as Record<AdPlacement, string>;
const maxKcn = (placement: AdPlacement) => (placement === "kcn_banner" ? AD_MAX_KCN : placement === "service_card" ? 1 : 0);

interface FormState {
  placement: AdPlacement;
  title: string;
  body: string;
  imageUrl: string;
  linkUrl: string;
  isHot: boolean;
  kcnIds: string[];
  showOnWeb: boolean;
  showOnApp: boolean;
  startsOn: string;
  endsOn: string;
  paused: boolean;
  customerNote: string;
}

const addDays = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86400_000).toISOString().slice(0, 10);

function emptyForm(): FormState {
  const today = adToday();
  return { placement: "homepage_banner", title: "", body: "", imageUrl: "", linkUrl: "", isHot: false, kcnIds: [], showOnWeb: true, showOnApp: true, startsOn: today, endsOn: addDays(today, 29), paused: false, customerNote: "" };
}

function toForm(ad: AdminAdItem): FormState {
  return {
    placement: ad.placement, title: ad.title, body: ad.body ?? "", imageUrl: ad.image_url ?? "", linkUrl: ad.link_url ?? "", isHot: ad.is_hot, kcnIds: [...ad.kcn_ids],
    showOnWeb: ad.show_on_web, showOnApp: ad.show_on_app, startsOn: ad.starts_on, endsOn: ad.ends_on, paused: ad.status === "paused", customerNote: ad.customer_note ?? "",
  };
}

// Đổi vị trí thì đưa lựa chọn về mức hợp lệ và bỏ ảnh đã chọn (ảnh theo khung của vị trí cũ).
function withPlacement(form: FormState, placement: AdPlacement): FormState {
  const next: FormState = { ...form, placement, kcnIds: form.kcnIds.slice(0, maxKcn(placement)), imageUrl: placement === form.placement ? form.imageUrl : "" };
  if (placement === "sidebar") { next.showOnWeb = true; next.showOnApp = false; }
  if (placement !== "service_card") next.isHot = false;
  return next;
}

function toBody(form: FormState) {
  return {
    placement: form.placement, title: form.title.trim(), body: form.body.trim() || null, imageUrl: form.imageUrl || null, linkUrl: form.linkUrl.trim() || null,
    isHot: form.placement === "service_card" && form.isHot, kcnIds: form.kcnIds, showOnWeb: form.showOnWeb, showOnApp: form.showOnApp,
    startsOn: form.startsOn, endsOn: form.endsOn, status: form.paused ? "paused" : "active", customerNote: form.customerNote.trim() || null,
  };
}

function stateOf(ad: AdminAdItem, today: string) {
  if (ad.status === "paused") return { label: "Tạm dừng", className: "bg-black/5 text-brand-navy/60" };
  if (ad.ends_on < today) return { label: "Hết hạn", className: "bg-black/5 text-brand-navy/60" };
  if (ad.starts_on > today) return { label: "Sắp chạy", className: "bg-amber-100 text-amber-800" };
  return { label: "Đang chạy", className: "bg-green-100 text-green-800" };
}

const input = "mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] text-brand-navy outline-none focus:border-brand-orange disabled:opacity-60";
const label = "block text-[12px] font-semibold text-brand-navy/60";
const secondary = "rounded-lg border border-black/10 px-3 py-2 text-[12.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40";

// Đọc kích thước ảnh ngay trên trình duyệt để báo lỗi sớm; máy chủ kiểm tra lại khi tải lên.
function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh đã chọn.")); };
    image.src = url;
  });
}

function AdForm({ editing, initial, kcnOptions, onClose }: { editing: AdminAdItem | null; initial: FormState; kcnOptions: KcnOption[]; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const busy = useRef(false);
  const set = (patch: Partial<FormState>) => setForm((previous) => ({ ...previous, ...patch }));
  const kcnLabel = (id: string) => kcnOptions.find((option) => option.id === id)?.label ?? "KCN";
  const limit = maxKcn(form.placement);
  const disabled = saving || uploading || uncertain;

  async function pickImage(file: File | undefined) {
    if (!file || busy.current) return;
    busy.current = true;
    setError(null);
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Chọn ảnh PNG, JPG hoặc WEBP.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Ảnh tối đa 5MB.");
      const size = await imageSize(file);
      const sizeError = adImageSizeError(form.placement, size.width, size.height);
      if (sizeError) throw new Error(sizeError);
      setUploading(true);
      const upload = new FormData();
      upload.append("file", file);
      upload.append("placement", form.placement);
      const response = await fetch("/api/mobile/admin/ads/upload", { method: "POST", body: upload });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true || typeof data.url !== "string") throw new Error(data?.error ?? "Không tải được ảnh lên.");
      set({ imageUrl: data.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh lên.");
    } finally {
      busy.current = false;
      setUploading(false);
    }
  }

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  async function save() {
    if (busy.current || uncertain) return;
    const body = toBody(form);
    const parsed = adCreateSchema.safeParse(body);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Thông tin quảng cáo chưa hợp lệ."); return; }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const { response, data } = await request(editing ? `/api/mobile/admin/ads/${editing.id}` : "/api/mobile/admin/ads", editing ? "PATCH" : "POST", body);
      if (response.status >= 500) { setUncertain(true); setError("Chưa xác định quảng cáo đã được lưu hay chưa. Hãy tải lại trang để kiểm tra trước khi lưu lại."); return; }
      if (!response.ok) { setError(data?.error ?? "Không lưu được quảng cáo."); return; }
      router.refresh();
      onClose();
    } catch {
      setUncertain(true);
      setError("Không kết nối được máy chủ. Chưa xác định quảng cáo đã được lưu hay chưa; hãy tải lại trang trước khi lưu lại.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing || busy.current || !window.confirm("Xóa quảng cáo? Quảng cáo sẽ biến mất khỏi danh sách và không hiển thị nữa. Muốn chỉ ngừng hiển thị, hãy bật \"Tạm dừng\".")) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const { response, data } = await request(`/api/mobile/admin/ads/${editing.id}`, "DELETE");
      if (response.status >= 500) { setUncertain(true); setError("Chưa xác định quảng cáo đã được xóa hay chưa. Hãy tải lại trang để kiểm tra."); return; }
      if (!response.ok && response.status !== 404) { setError(data?.error ?? "Không xóa được quảng cáo."); return; }
      router.refresh();
      onClose();
    } catch {
      setUncertain(true);
      setError("Không kết nối được máy chủ. Chưa xác định quảng cáo đã được xóa hay chưa; hãy tải lại trang để kiểm tra.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const available = kcnOptions.filter((option) => !form.kcnIds.includes(option.id));
  return (
    <div className="mb-5 rounded-2xl border border-brand-orange/30 bg-white p-5 shadow-sm">
      <div className="mb-4 text-[14px] font-extrabold text-brand-navy">{editing ? "Sửa quảng cáo" : "Thêm quảng cáo"}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          Vị trí
          <select value={form.placement} disabled={!!editing || disabled} onChange={(event) => setForm((previous) => withPlacement(previous, event.target.value as AdPlacement))} className={input}>
            {PLACEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          {editing && <span className="mt-1 block text-[11.5px] font-normal text-brand-navy/45">Không đổi được vị trí của quảng cáo đã tạo; muốn đổi hãy tạo quảng cáo mới.</span>}
        </label>
        <label className={label}>
          Tiêu đề *
          <input value={form.title} maxLength={100} disabled={disabled} onChange={(event) => set({ title: event.target.value })} placeholder="Ví dụ: Nhà trọ Sao Mai - gần KCN" className={input} />
        </label>
        <label className={`${label} md:col-span-2`}>
          Nội dung (không bắt buộc)
          <textarea value={form.body} maxLength={300} rows={2} disabled={disabled} onChange={(event) => set({ body: event.target.value })} placeholder="Một hai câu giới thiệu, hiện ở card" className={input} />
        </label>

        <div className="md:col-span-2">
          <div className={label}>{form.placement === "service_card" ? "Ảnh (không bắt buộc)" : "Ảnh quảng cáo *"}</div>
          {form.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.imageUrl} alt="Ảnh quảng cáo đã chọn" className="mt-2 max-h-48 rounded-lg border border-black/10 object-contain" />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className={`${secondary} cursor-pointer ${disabled ? "pointer-events-none opacity-40" : ""}`}>
              {uploading ? "Đang tải ảnh…" : form.imageUrl ? "Chọn ảnh khác" : "Chọn ảnh từ máy"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={disabled} onChange={(event) => { void pickImage(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
            {form.imageUrl && form.placement === "service_card" && <button type="button" disabled={disabled} className={secondary} onClick={() => set({ imageUrl: "" })}>Bỏ ảnh</button>}
          </div>
          <p className="mt-1 text-[11.5px] text-brand-navy/45">{adImageHint(form.placement)} Ảnh sai kích thước sẽ bị từ chối.</p>
        </div>

        <label className={`${label} md:col-span-2`}>
          Liên kết khi bấm (không bắt buộc)
          <input value={form.linkUrl} disabled={disabled} onChange={(event) => set({ linkUrl: event.target.value })} placeholder="https://zalo.me/... hoặc tel:+84901234567" className={input} />
        </label>

        {limit > 0 && (
          <div className="md:col-span-2">
            <div className={label}>{form.placement === "kcn_banner" ? `KCN áp dụng (1 đến ${limit}; chọn 5 là gói Bundle 5 KCN)` : "KCN áp dụng (chọn 1)"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.kcnIds.map((id) => (
                <span key={id} className="inline-flex items-center gap-2 rounded-full bg-brand-orange-light px-3 py-1 text-[12px] font-semibold text-brand-orange">
                  {kcnLabel(id)}
                  <button type="button" aria-label={`Bỏ ${kcnLabel(id)}`} disabled={disabled} onClick={() => set({ kcnIds: form.kcnIds.filter((item) => item !== id) })}>✕</button>
                </span>
              ))}
            </div>
            {form.kcnIds.length < limit && (
              <select value="" disabled={disabled || available.length === 0} onChange={(event) => event.target.value && set({ kcnIds: [...form.kcnIds, event.target.value] })} className={input}>
                <option value="">+ Thêm KCN</option>
                {available.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            )}
          </div>
        )}

        <div>
          <div className={label}>Hiển thị trên</div>
          <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-brand-navy/70">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.showOnWeb} disabled={disabled || form.placement === "sidebar"} onChange={(event) => set({ showOnWeb: event.target.checked })} /> Web</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.showOnApp} disabled={disabled || form.placement === "sidebar"} onChange={(event) => set({ showOnApp: event.target.checked })} /> App</label>
          </div>
          {form.placement === "sidebar" && <p className="mt-1 text-[11.5px] text-brand-navy/45">Sidebar chỉ có trên web.</p>}
          {form.placement === "service_card" && (
            <label className="mt-3 flex items-center gap-2 text-[13px] text-brand-navy/70">
              <input type="checkbox" checked={form.isHot} disabled={disabled} onChange={(event) => set({ isHot: event.target.checked })} /> 🔥 Gắn nhãn HOT (card HOT luôn xếp đầu danh sách)
            </label>
          )}
        </div>

        <div>
          <div className={label}>Thời gian hiển thị (gồm cả hai ngày)</div>
          <div className="mt-1 flex gap-2">
            <input type="date" aria-label="Ngày bắt đầu" value={form.startsOn} disabled={disabled} onChange={(event) => set({ startsOn: event.target.value })} className={input} />
            <input type="date" aria-label="Ngày kết thúc" value={form.endsOn} disabled={disabled} onChange={(event) => set({ endsOn: event.target.value })} className={input} />
          </div>
          <p className="mt-1 text-[11.5px] text-brand-navy/45">Hết ngày kết thúc thì quảng cáo tự ngừng hiển thị.</p>
          <label className="mt-2 flex items-center gap-2 text-[13px] text-brand-navy/70">
            <input type="checkbox" checked={form.paused} disabled={disabled} onChange={(event) => set({ paused: event.target.checked })} /> Tạm dừng (không hiển thị, giữ lại nội dung)
          </label>
        </div>

        <label className={`${label} md:col-span-2`}>
          Ghi chú nội bộ (khách, gói, giá đã chốt; không hiển thị cho người dùng)
          <textarea value={form.customerNote} maxLength={500} rows={2} disabled={disabled} onChange={(event) => set({ customerNote: event.target.value })} placeholder="Ví dụ: Công ty A, Bundle 5 KCN, 2.5tr, đã chuyển khoản" className={input} />
        </label>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700">{error}</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={save} className="rounded-lg bg-brand-orange px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-105 disabled:opacity-60">
          {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo quảng cáo"}
        </button>
        <button type="button" disabled={saving} onClick={() => { if (uncertain) router.refresh(); onClose(); }} className={secondary}>{uncertain ? "Đóng và tải lại danh sách" : "Hủy"}</button>
        {editing && <button type="button" disabled={disabled} onClick={remove} className="rounded-lg border border-red-300 px-3 py-2 text-[12.5px] font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-40">Xóa</button>}
      </div>
    </div>
  );
}

// Quản lý quảng cáo hiển thị (banner, sidebar, card) trên trang Admin web: cùng API và quy tắc với app Admin.
export function AdPlacementManagement({ ads, kcnOptions, loadError }: { ads: AdminAdItem[]; kcnOptions: KcnOption[]; loadError: boolean }) {
  const [filter, setFilter] = useState<AdPlacement | "">("");
  const [editing, setEditing] = useState<{ ad: AdminAdItem | null; initial: FormState } | null>(null);
  const today = adToday();
  const shown = filter ? ads.filter((ad) => ad.placement === filter) : ads;
  const kcnName = (id: string) => kcnOptions.find((option) => option.id === id)?.label ?? "KCN";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-extrabold text-brand-navy">📣 Quảng cáo hiển thị</h1>
          <p className="mt-1 text-[12.5px] text-brand-navy/50">Banner trang chủ, sidebar, banner KCN / Bundle 5 KCN và card nhà trọ/dịch vụ · {shown.length.toLocaleString("vi-VN")} quảng cáo</p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={(event) => setFilter(event.target.value as AdPlacement | "")} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange">
            <option value="">Mọi vị trí</option>
            {PLACEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button type="button" onClick={() => setEditing({ ad: null, initial: emptyForm() })} className="rounded-lg bg-brand-orange px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:brightness-105">+ Thêm quảng cáo</button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-brand-orange/15 bg-gradient-to-br from-brand-orange-light to-transparent px-4 py-3 text-[12.5px] text-brand-navy/60">
        Bán theo hướng tư vấn, chốt ngoài hệ thống: tạo quảng cáo sau khi khách đã chốt. Banner và sidebar chỉ một quảng cáo tại một chỗ trong cùng thời gian; card không giới hạn, card HOT xếp đầu.
      </div>

      {editing && <AdForm key={editing.ad?.id ?? "new"} editing={editing.ad} initial={editing.initial} kcnOptions={kcnOptions} onClose={() => setEditing(null)} />}

      {loadError && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">Chưa tải được danh sách quảng cáo. Hãy thử lại sau.</div>}

      <div className="flex flex-col gap-3">
        {shown.map((ad) => {
          const state = stateOf(ad, today);
          return (
            <div key={ad.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold text-brand-navy">{ad.is_hot ? "🔥 " : ""}{ad.title}</div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-brand-orange">{PLACEMENT_LABEL[ad.placement]} · {[ad.show_on_web && "Web", ad.show_on_app && "App"].filter(Boolean).join(" + ")}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${state.className}`}>{state.label}</span>
              </div>
              {ad.kcn_ids.length > 0 && <div className="mt-1 text-[12px] text-brand-navy/60">KCN: {ad.kcn_ids.map(kcnName).join(", ")}</div>}
              <div className="mt-1 text-[12px] text-brand-navy/50">{ad.starts_on} → {ad.ends_on}</div>
              {ad.customer_note && <div className="mt-1 text-[12px] text-brand-navy/50">Ghi chú: {ad.customer_note}</div>}
              <div className="mt-3">
                <button type="button" onClick={() => setEditing({ ad, initial: toForm(ad) })} className={secondary}>Sửa</button>
              </div>
            </div>
          );
        })}
        {!loadError && shown.length === 0 && <div className="rounded-2xl border border-black/5 bg-white p-8 text-center text-[13px] text-brand-navy/40">Chưa có quảng cáo nào.</div>}
      </div>
    </div>
  );
}
