"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { KcnRow } from "@/types/db";
import { PROVINCES } from "@/lib/provinces";
import { JOB_INDUSTRIES } from "@/lib/industries";

interface KcnFormState {
  name: string;
  provinceCode: string;
  address: string;
  totalAreaHa: string;
  occupiedPct: string;
  activeCompanies: string;
  industries: string[];
  lat: string;
  lng: string;
}

const EMPTY_FORM: KcnFormState = {
  name: "",
  provinceCode: "",
  address: "",
  totalAreaHa: "",
  occupiedPct: "",
  activeCompanies: "0",
  industries: [],
  lat: "",
  lng: "",
};

function toForm(kcn: KcnRow): KcnFormState {
  return {
    name: kcn.name,
    provinceCode: kcn.province_code,
    address: kcn.address ?? "",
    totalAreaHa: kcn.total_area_ha !== null ? String(kcn.total_area_ha) : "",
    occupiedPct: kcn.occupied_pct !== null ? String(kcn.occupied_pct) : "",
    activeCompanies: String(kcn.active_companies),
    industries: kcn.industries ?? [],
    lat: kcn.lat !== null ? String(kcn.lat) : "",
    lng: kcn.lng !== null ? String(kcn.lng) : "",
  };
}

function toBody(form: KcnFormState) {
  return {
    name: form.name,
    provinceCode: form.provinceCode,
    address: form.address || undefined,
    totalAreaHa: form.totalAreaHa === "" ? undefined : Number(form.totalAreaHa),
    occupiedPct: form.occupiedPct === "" ? undefined : Number(form.occupiedPct),
    activeCompanies: form.activeCompanies === "" ? undefined : Number(form.activeCompanies),
    industries: form.industries.length ? form.industries : undefined,
    lat: form.lat === "" ? undefined : Number(form.lat),
    lng: form.lng === "" ? undefined : Number(form.lng),
  };
}

export function KcnManagement({ kcnList }: { kcnList: KcnRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KcnRow | null>(null);
  const [form, setForm] = useState<KcnFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editing !== null;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(kcn: KcnRow) {
    setEditing(kcn);
    setForm(toForm(kcn));
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function updateField<K extends keyof KcnFormState>(field: K, value: KcnFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleIndustry(value: string) {
    setForm((current) => ({
      ...current,
      industries: current.industries.includes(value)
        ? current.industries.filter((v) => v !== value)
        : [...current.industries, value],
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(isEditing ? `/api/admin/kcn/${editing.id}` : "/api/admin/kcn", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(form)),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Không lưu được KCN.");
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

  async function handleDelete(kcn: KcnRow) {
    if (!window.confirm(`Xoá KCN "${kcn.name}"? Các tin tuyển dụng đang gắn KCN này sẽ được gỡ liên kết (không bị xoá).`)) return;
    setDeletingId(kcn.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/kcn/${kcn.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không xoá được KCN.");
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
          <h1 className="text-[16px] font-extrabold text-brand-navy">🏭 KCN toàn quốc</h1>
          <p className="mt-1 text-[13px] text-brand-navy/50">
            Danh bạ Khu công nghiệp hiển thị ở tab &quot;KCN toàn quốc&quot; trang Tìm việc làm ({kcnList.length.toLocaleString("vi-VN")}).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105"
        >
          + Thêm KCN
        </button>
      </div>

      {error && !formOpen && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
      )}

      {kcnList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Chưa có KCN nào.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">KCN</th>
                <th className="px-4 py-3 font-semibold">Tỉnh/Thành</th>
                <th className="px-4 py-3 font-semibold">Diện tích / Lấp đầy</th>
                <th className="px-4 py-3 font-semibold">DN / Tin đang tuyển</th>
                <th className="px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {kcnList.map((kcn) => (
                <tr key={kcn.id} className="border-t border-black/5 align-top">
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand-navy">{kcn.name}</div>
                    {kcn.address && <div className="mt-0.5 text-[11px] text-brand-navy/40">{kcn.address}</div>}
                  </td>
                  <td className="px-4 py-3 text-brand-navy/60">{kcn.province_name}</td>
                  <td className="px-4 py-3 text-brand-navy/60">
                    {kcn.total_area_ha !== null ? `${kcn.total_area_ha} ha` : "‑"}
                    {kcn.occupied_pct !== null ? ` · ${kcn.occupied_pct}%` : ""}
                  </td>
                  <td className="px-4 py-3 font-mono text-brand-navy/60">
                    {kcn.active_companies} DN · {kcn.active_jobs} tin
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(kcn)}
                        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(kcn)}
                        disabled={deletingId === kcn.id}
                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deletingId === kcn.id ? "Đang xoá…" : "Xoá"}
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
          <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-[90vw] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-extrabold text-brand-navy">{isEditing ? "Sửa KCN" : "Thêm KCN mới"}</h2>
                <p className="mt-1 text-[12px] text-brand-navy/45">Hiển thị công khai ở tab &quot;KCN toàn quốc&quot;.</p>
              </div>
              <button type="button" onClick={closeForm} disabled={saving} className="text-xl leading-none text-brand-navy/35 hover:text-brand-navy">
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Tên KCN *
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                  minLength={3}
                  placeholder="VD: KCN Sóng Thần"
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Tỉnh / Thành phố *
                  <select
                    value={form.provinceCode}
                    onChange={(e) => updateField("provinceCode", e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                  >
                    <option value="" disabled>
                      -- Chọn tỉnh thành --
                    </option>
                    {PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Địa chỉ
                  <input
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="VD: Dĩ An, Bình Dương"
                    className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Diện tích (ha)
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={form.totalAreaHa}
                    onChange={(e) => updateField("totalAreaHa", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                  />
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Tỷ lệ lấp đầy (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={form.occupiedPct}
                    onChange={(e) => updateField("occupiedPct", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                  />
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Số DN đang hoạt động
                  <input
                    type="number"
                    min={0}
                    value={form.activeCompanies}
                    onChange={(e) => updateField("activeCompanies", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                  />
                </label>
              </div>

              <div>
                <div className="text-[12px] font-semibold text-brand-navy/60">Ngành nghề chính</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {JOB_INDUSTRIES.map((i) => (
                    <label
                      key={i.value}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                        form.industries.includes(i.value)
                          ? "border-brand-orange bg-brand-orange-light text-brand-orange"
                          : "border-black/10 text-brand-navy/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.industries.includes(i.value)}
                        onChange={() => toggleIndustry(i.value)}
                        className="hidden"
                      />
                      {i.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Vĩ độ (lat)
                  <input
                    type="number"
                    step="0.0000001"
                    value={form.lat}
                    onChange={(e) => updateField("lat", e.target.value)}
                    placeholder="VD: 10.9000"
                    className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                  />
                </label>
                <label className="block text-[12px] font-semibold text-brand-navy/60">
                  Kinh độ (lng)
                  <input
                    type="number"
                    step="0.0000001"
                    value={form.lng}
                    onChange={(e) => updateField("lng", e.target.value)}
                    placeholder="VD: 106.7700"
                    className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                  />
                </label>
              </div>
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-black/10 px-3.5 py-2.5 text-[12.5px] font-bold text-brand-navy/60 disabled:opacity-50">
                Hủy
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-60">
                {saving ? "Đang lưu…" : isEditing ? "Lưu thay đổi" : "Tạo KCN"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
