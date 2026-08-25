"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import type { AdminAdvertisingPricingCardRow } from "@/lib/admin";

interface PricingFormState {
  format: string;
  placement: string;
  price: string;
  unit: string;
  ctaLabel: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: PricingFormState = {
  format: "",
  placement: "",
  price: "",
  unit: "",
  ctaLabel: "Đặt ngay",
  sortOrder: "0",
  isActive: true,
};

function toForm(card: AdminAdvertisingPricingCardRow): PricingFormState {
  return {
    format: card.format,
    placement: card.placement,
    price: card.price,
    unit: card.unit,
    ctaLabel: card.cta_label,
    sortOrder: String(card.sort_order),
    isActive: card.is_active,
  };
}

export function AdvertisingPricingManagement({ cards }: { cards: AdminAdvertisingPricingCardRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAdvertisingPricingCardRow | null>(null);
  const [form, setForm] = useState<PricingFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editing !== null;

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: String(cards.length + 1) });
    setError(null);
    setFormOpen(true);
  }

  function openEdit(card: AdminAdvertisingPricingCardRow) {
    setEditing(card);
    setForm(toForm(card));
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function updateField<K extends keyof PricingFormState>(field: K, value: PricingFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(isEditing ? `/api/admin/advertising-pricing/${editing.id}` : "/api/admin/advertising-pricing", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: form.format,
          placement: form.placement,
          price: form.price,
          unit: form.unit,
          ctaLabel: form.ctaLabel,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không lưu được bảng giá.");
        return;
      }
      closeForm();
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(card: AdminAdvertisingPricingCardRow) {
    setTogglingId(card.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/advertising-pricing/${card.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !card.is_active }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không đổi được trạng thái bảng giá.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(card: AdminAdvertisingPricingCardRow) {
    if (!window.confirm(`Xoá gói quảng cáo "${card.format}"? Không thể hoàn tác.`)) return;
    setDeletingId(card.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/advertising-pricing/${card.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không xoá được bảng giá.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-extrabold text-brand-navy">💰 Bảng giá quảng cáo · Quản lý</h1>
          <p className="mt-1 text-[13px] text-brand-navy/50">
            Thêm, sửa, ẩn hoặc xoá các gói hiển thị trong tab Bảng giá quảng cáo ({cards.length.toLocaleString("vi-VN")} gói).
          </p>
        </div>
        <button type="button" onClick={openCreate} className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105">
          + Thêm bảng giá
        </button>
      </div>

      {error && !formOpen && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">Chưa có bảng giá quảng cáo nào.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Định dạng</th>
                <th className="px-4 py-3 font-semibold">Vị trí</th>
                <th className="px-4 py-3 font-semibold">Giá</th>
                <th className="px-4 py-3 font-semibold">Đơn vị</th>
                <th className="px-4 py-3 font-semibold">Thứ tự</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id} className="border-t border-black/5 align-top">
                  <td className="px-4 py-3 font-bold text-brand-navy">{card.format}</td>
                  <td className="max-w-[250px] px-4 py-3 text-brand-navy/60">{card.placement}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-extrabold text-brand-orange">{card.price}</td>
                  <td className="max-w-[190px] px-4 py-3 text-brand-navy/60">{card.unit}</td>
                  <td className="px-4 py-3 font-mono text-brand-navy/60">{card.sort_order}</td>
                  <td className="px-4 py-3">{card.is_active ? <StatusPill label="Đang hiển thị" tone="green" /> : <StatusPill label="Đã ẩn" tone="gray" />}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => openEdit(card)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange">Sửa</button>
                      <button type="button" onClick={() => handleToggleActive(card)} disabled={togglingId === card.id} className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${card.is_active ? "border border-black/10 text-brand-navy/65 hover:border-amber-300 hover:text-amber-600" : "bg-emerald-600 text-white hover:brightness-105"}`}>
                        {togglingId === card.id ? "…" : card.is_active ? "Ẩn" : "Đăng"}
                      </button>
                      <button type="button" onClick={() => handleDelete(card)} disabled={deletingId === card.id} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
                        {deletingId === card.id ? "Đang xoá…" : "Xoá"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/45 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSubmit} className="w-full max-w-[720px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[16px] font-extrabold text-brand-navy">{isEditing ? "Sửa bảng giá quảng cáo" : "Thêm bảng giá quảng cáo"}</h2>
              <button type="button" onClick={closeForm} disabled={saving} className="text-xl leading-none text-brand-navy/35 hover:text-brand-navy">×</button>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Định dạng *
                  <input value={form.format} onChange={(event) => updateField("format", event.target.value)} required minLength={2} placeholder="Banner KCN" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Vị trí *
                  <input value={form.placement} onChange={(event) => updateField("placement", event.target.value)} required placeholder="Trang KCN + Job list của KCN" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Giá *
                  <input value={form.price} onChange={(event) => updateField("price", event.target.value)} required placeholder="800.000đ" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Đơn vị / thời hạn *
                  <input value={form.unit} onChange={(event) => updateField("unit", event.target.value)} required placeholder="1 KCN · 30 ngày" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Nội dung nút *
                  <input value={form.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} required placeholder="Đặt ngay" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Thứ tự hiển thị
                  <input type="number" min={0} value={form.sortOrder} onChange={(event) => updateField("sortOrder", event.target.value)} className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-brand-navy/70">
                <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
                Hiển thị công khai trong Bảng giá quảng cáo
              </label>
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-black/10 px-3.5 py-2.5 text-[12.5px] font-bold text-brand-navy/60 disabled:opacity-50">Hủy</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-60">
                {saving ? "Đang lưu…" : isEditing ? "Lưu thay đổi" : "Tạo bảng giá"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
