"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminUserRole, AdminUserRow } from "@/lib/admin";
import { StatusPill } from "@/components/admin/StatusPill";

const ROLE_OPTIONS: { value: AdminUserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "employer", label: "Nhà tuyển dụng" },
  { value: "agency", label: "Đại lý" },
  { value: "candidate", label: "Ứng viên" },
];

const ROLE_META: Record<AdminUserRole, { label: string; tone: "amber" | "green" | "gray" | "blue" }> = {
  admin: { label: "Admin", tone: "amber" },
  employer: { label: "Nhà tuyển dụng", tone: "blue" },
  agency: { label: "Đại lý", tone: "blue" },
  candidate: { label: "Ứng viên", tone: "gray" },
};

interface UserFormState {
  fullName: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  password: string;
}

const EMPTY_FORM: UserFormState = {
  fullName: "",
  email: "",
  phone: "",
  role: "candidate",
  password: "",
};

function toRole(value: string): AdminUserRole {
  return ROLE_OPTIONS.some((option) => option.value === value) ? (value as AdminUserRole) : "candidate";
}

function toForm(user: AdminUserRow): UserFormState {
  return {
    fullName: user.full_name,
    email: user.email ?? "",
    phone: user.phone ?? "",
    role: toRole(user.role),
    password: "",
  };
}

export function UserManagement({ users, currentAdminId }: { users: AdminUserRow[]; currentAdminId: string }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editingUser !== null;
  const passwordRequired = form.role === "admin" || form.role === "employer";

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(user: AdminUserRow) {
    setEditingUser(user);
    setForm(toForm(user));
    setError(null);
    setFormOpen(true);
  }

  const contactLocked = editingUser?.status === "deleted";

  function closeForm() {
    setFormOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function updateField<K extends keyof UserFormState>(field: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Không lưu được người dùng.");
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

  async function handleDelete(user: AdminUserRow) {
    if (user.id === currentAdminId) return;
    if (!window.confirm(`Đánh dấu tài khoản "${user.full_name}" là Đã xóa? Tài khoản sẽ không thể đăng nhập và email vẫn được giữ lại.`)) return;

    setDeletingId(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không xóa được người dùng.");
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
          <h1 className="text-[16px] font-extrabold text-brand-navy">👤 Người dùng</h1>
          <p className="mt-1 text-[13px] text-brand-navy/50">
            Toàn bộ tài khoản trong hệ thống ({users.length.toLocaleString("vi-VN")}) — Admin, nhà tuyển dụng, ứng viên.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105"
        >
          + Thêm người dùng
        </button>
      </div>

      {error && !formOpen && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
              <th className="px-4 py-3 font-semibold">Tên</th>
              <th className="px-4 py-3 font-semibold">Email / SĐT</th>
              <th className="px-4 py-3 font-semibold">Vai trò</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold">Ngày tạo</th>
              <th className="px-4 py-3 font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const role = ROLE_META[toRole(user.role)];
              const isCurrentAdmin = user.id === currentAdminId;
              return (
                <tr key={user.id} className="border-t border-black/5 align-top">
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand-navy">{user.full_name}</div>
                    {isCurrentAdmin && <div className="mt-0.5 text-[11px] text-brand-orange">Tài khoản đang đăng nhập</div>}
                  </td>
                  <td className="px-4 py-3 text-brand-navy/60">
                    <div>{user.email ?? "—"}</div>
                    {user.phone && <div className="mt-0.5 text-[11px] text-brand-navy/40">{user.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill label={role.label} tone={role.tone} />
                  </td>
                  <td className="px-4 py-3">
                    {user.status === "active" ? <StatusPill label="Đang hoạt động" tone="green" /> : <StatusPill label="Đã xóa" tone="red" />}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-brand-navy/40">
                    {new Date(user.created_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        disabled={isCurrentAdmin || user.status === "deleted" || deletingId === user.id}
                        title={
                          isCurrentAdmin
                            ? "Không thể xóa tài khoản đang đăng nhập"
                            : user.status === "deleted"
                              ? "Tài khoản đã ở trạng thái Đã xóa"
                              : "Đánh dấu tài khoản là Đã xóa"
                        }
                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deletingId === user.id ? "Đang cập nhật…" : user.status === "deleted" ? "Đã xóa" : "Xóa"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/45 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-extrabold text-brand-navy">{isEditing ? "Sửa người dùng" : "Thêm người dùng"}</h2>
                <p className="mt-1 text-[12px] text-brand-navy/45">
                  {isEditing ? "Cập nhật thông tin tài khoản. Để trống mật khẩu nếu không muốn đổi." : "Tạo tài khoản mới trong hệ thống."}
                </p>
              </div>
              <button type="button" onClick={closeForm} disabled={saving} className="text-xl leading-none text-brand-navy/35 hover:text-brand-navy">
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
                Họ và tên *
                <input
                  value={form.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
                  required
                  minLength={2}
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                />
              </label>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  disabled={contactLocked}
                  title={contactLocked ? "Email được giữ lại để chặn đăng ký lại" : undefined}
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-brand-navy/45"
                />
              </label>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Số điện thoại
                <input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  minLength={form.phone ? 9 : undefined}
                  disabled={contactLocked}
                  title={contactLocked ? "Số điện thoại được giữ lại của tài khoản đã xóa" : undefined}
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-brand-navy/45"
                />
              </label>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Vai trò *
                <select
                  value={form.role}
                  onChange={(event) => updateField("role", event.target.value as AdminUserRole)}
                  className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                {isEditing ? "Mật khẩu mới" : "Mật khẩu"}{passwordRequired ? " *" : ""}
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  required={!isEditing && passwordRequired}
                  minLength={form.password ? 8 : undefined}
                  autoComplete="new-password"
                  placeholder={isEditing ? "Để trống nếu không đổi" : "Tối thiểu 8 ký tự"}
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                />
              </label>
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-black/10 px-3.5 py-2.5 text-[12.5px] font-bold text-brand-navy/60 disabled:opacity-50">
                Hủy
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-60">
                {saving ? "Đang lưu…" : isEditing ? "Lưu thay đổi" : "Tạo người dùng"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
