"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminServicePackageCardRow } from "@/lib/admin";
import type { ServicePackageCardRow } from "@/types/db";
import { StatusPill } from "@/components/admin/StatusPill";

interface CardFormState {
  icon: string;
  title: string;
  description: string;
  features: string;
  price: string;
  ctaLabel: string;
  accent: ServicePackageCardRow["accent"];
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: CardFormState = {
  icon: "🎯",
  title: "",
  description: "",
  features: "",
  price: "",
  ctaLabel: "Tư vấn ngay",
  accent: "orange",
  sortOrder: "0",
  isActive: true,
};

function toForm(card: AdminServicePackageCardRow): CardFormState {
  return {
    icon: card.icon,
    title: card.title,
    description: card.description,
    features: card.features.join("\n"),
    price: card.price,
    ctaLabel: card.cta_label,
    accent: card.accent,
    sortOrder: String(card.sort_order),
    isActive: card.is_active,
  };
}

export function ServicePackageManagement({ cards }: { cards: AdminServicePackageCardRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminServicePackageCardRow | null>(null);
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editing !== null;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(card: AdminServicePackageCardRow) {
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

  function updateField<K extends keyof CardFormState>(field: K, value: CardFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(isEditing ? `/api/admin/service-packages/${editing.id}` : "/api/admin/service-packages", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icon: form.icon,
          title: form.title,
          description: form.description,
          features: form.features.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
          price: form.price,
          ctaLabel: form.ctaLabel,
          accent: form.accent,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Không lưu được dịch vụ.");
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

  async function handleToggleActive(card: AdminServicePackageCardRow) {
    setTogglingId(card.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/service-packages/${card.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !card.is_active }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không đổi được trạng thái dịch vụ.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(card: AdminServicePackageCardRow) {
    if (!window.confirm(`Xoá dịch vụ "${card.title}"? Không thể hoàn tác.`)) return;
    setDeletingId(card.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/service-packages/${card.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không xoá được dịch vụ.");
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
          <h1 className="text-[16px] font-extrabold text-brand-navy">📦 Dịch vụ trọn gói · Quản lý</h1>
          <p className="mt-1 text-[13px] text-brand-navy/50">
            Thêm, sửa, ẩn hoặc xoá các thẻ hiển thị trên trang Dịch vụ trọn gói ({cards.length.toLocaleString("vi-VN")}).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105"
        >
          + Thêm dịch vụ
        </button>
      </div>

      {error && !formOpen && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Chưa có dịch vụ nào.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full min-w-[940px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Dịch vụ</th>
                <th className="px-4 py-3 font-semibold">Mức giá</th>
                <th className="px-4 py-3 font-semibold">Thứ tự</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id} className="border-t border-black/5 align-top">
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand-navy">{card.icon} {card.title}</div>
                    <div className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-brand-navy/45">{card.description}</div>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 font-bold text-brand-orange">{card.price}</td>
                  <td className="px-4 py-3 font-mono text-brand-navy/60">{card.sort_order}</td>
                  <td className="px-4 py-3">
                    {card.is_active ? <StatusPill label="Đang hiển thị" tone="green" /> : <StatusPill label="Đã ẩn" tone="gray" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(card)}
                        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(card)}
                        disabled={togglingId === card.id}
                        className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${card.is_active ? "border border-black/10 text-brand-navy/65 hover:border-amber-300 hover:text-amber-600" : "bg-emerald-600 text-white hover:brightness-105"}`}
                      >
                        {togglingId === card.id ? "…" : card.is_active ? "Ẩn" : "Đăng"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(card)}
                        disabled={deletingId === card.id}
                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
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
          <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[16px] font-extrabold text-brand-navy">{isEditing ? "Sửa dịch vụ" : "Thêm dịch vụ"}</h2>
              <button type="button" onClick={closeForm} disabled={saving} className="text-xl leading-none text-brand-navy/35 hover:text-brand-navy">×</button>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[78px_1fr]">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Icon
                  <input value={form.icon} onChange={(e) => updateField("icon", e.target.value)} required className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-center text-[17px] outline-none focus:border-brand-orange" />
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Tên dịch vụ *
                  <input value={form.title} onChange={(e) => updateField("title", e.target.value)} required minLength={2} className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
              </div>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Mô tả dịch vụ *
                <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} required minLength={10} rows={4} className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] leading-relaxed text-brand-navy outline-none focus:border-brand-orange" />
              </label>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Tính năng / nội dung nổi bật * (mỗi dòng một ý)
                <textarea value={form.features} onChange={(e) => updateField("features", e.target.value)} required rows={5} placeholder="Sàng lọc hồ sơ theo tiêu chí doanh nghiệp\nTổ chức ngày phỏng vấn tại chỗ hoặc online" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] leading-relaxed text-brand-navy outline-none focus:border-brand-orange" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Mức giá / báo giá *
                  <input value={form.price} onChange={(e) => updateField("price", e.target.value)} required placeholder="Từ 3.000.000đ / chiến dịch" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Nội dung nút *
                  <input value={form.ctaLabel} onChange={(e) => updateField("ctaLabel", e.target.value)} required placeholder="Tư vấn ngay" className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Màu nhấn
                  <select value={form.accent} onChange={(e) => updateField("accent", e.target.value as ServicePackageCardRow["accent"])} className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange">
                    <option value="orange">Cam</option>
                    <option value="green">Xanh lá</option>
                    <option value="amber">Vàng</option>
                    <option value="red">Đỏ</option>
                    <option value="full">Cam nổi bật toàn thẻ</option>
                  </select>
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Thứ tự hiển thị
                  <input type="number" min={0} value={form.sortOrder} onChange={(e) => updateField("sortOrder", e.target.value)} className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange" />
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-brand-navy/70">
                <input type="checkbox" checked={form.isActive} onChange={(e) => updateField("isActive", e.target.checked)} />
                Hiển thị công khai trên trang Dịch vụ trọn gói
              </label>
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-black/10 px-3.5 py-2.5 text-[12.5px] font-bold text-brand-navy/60 disabled:opacity-50">Hủy</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-60">
                {saving ? "Đang lưu…" : isEditing ? "Lưu thay đổi" : "Tạo dịch vụ"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
