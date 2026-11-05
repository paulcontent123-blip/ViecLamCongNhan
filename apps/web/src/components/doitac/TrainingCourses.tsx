"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import { MobileActionAlert, MobileFilterChips, MobilePager, MobileSearch, MobileStateCard } from "@/components/shared/mobileUi";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { StatusPill } from "@/components/admin/StatusPill";
import { useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import { formatDate } from "@/lib/format-date";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { createCourse, listCourses, updateCourse, type CourseRow } from "@/lib/training-provider-client";
import {
  COURSE_FILTERS,
  COURSE_LEVELS,
  COURSE_STATUS_LABEL,
  COURSE_STATUS_TONE,
  courseBody,
  courseToForm,
  EMPTY_COURSE_FORM,
  LEARNING_MODE_LABEL,
  LEARNING_MODES,
  validateCourseForm,
  type CourseFormValues,
} from "@/lib/training-provider-portal";
import { formatTuition } from "@/lib/worker-services";

const accent = PORTAL_ACCENT;
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
const MODE_OPTIONS = LEARNING_MODES.map((value) => ({ value, label: LEARNING_MODE_LABEL[value] }));
const LEVEL_OPTIONS = COURSE_LEVELS.map((value) => ({ value, label: value }));

const text = (value: unknown) => (typeof value === "string" ? value : "");

function CourseForm({
  initial,
  editingId,
  verified,
  onClose,
  onSaved,
}: {
  initial: CourseFormValues;
  editingId: string | null;
  verified: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const set = (key: keyof CourseFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function save(action: "save" | "submit") {
    if (busy || locked) return;
    const invalid = validateCourseForm(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editingId) await updateCourse(editingId, courseBody(values, action));
      // Tạo mới: máy chủ luôn đặt trạng thái chờ duyệt, không nhận `action`.
      else await createCourse(courseBody(values));
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chưa lưu được khóa học.";
      setError(message);
      // Kết quả chưa rõ thì khoá nút: gửi lại có thể tạo khóa học trùng.
      if (/Chưa xác định/.test(message)) setLocked(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-brand-navy/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="my-6 w-full max-w-[720px] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4">
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-widest ${accent.text}`}>Khóa học nghề</div>
            <h2 className="mt-1 text-[17px] font-extrabold text-brand-navy">
              {editingId ? "Chỉnh sửa khóa học" : "Tạo khóa học"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng form khóa học"
            className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 hover:bg-black/5"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <TextField label="Tên khóa học *" name="title" value={values.title} onChange={set("title")} disabled={busy || locked} maxLength={160} accent={accent} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Nghề / kỹ năng đào tạo *" name="occupation" value={values.occupation} onChange={set("occupation")} disabled={busy || locked} maxLength={120} accent={accent} />
            <SelectField label="Cấp độ" name="level" value={values.level} onChange={set("level")} options={LEVEL_OPTIONS} placeholder="Chưa chọn" disabled={busy || locked} accent={accent} />
          </div>
          <TextAreaField label="Mô tả khóa học * (tối thiểu 20 ký tự)" name="description" value={values.description} onChange={set("description")} disabled={busy || locked} rows={4} maxLength={10000} accent={accent} />
          <TextAreaField label="Điều kiện đầu vào" name="requirements" value={values.requirements} onChange={set("requirements")} disabled={busy || locked} rows={2} maxLength={3000} accent={accent} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Hình thức học *" name="learningMode" value={values.learningMode} onChange={set("learningMode")} options={MODE_OPTIONS} disabled={busy || locked} accent={accent} />
            <SelectField label="Tỉnh/thành" name="provinceCode" value={values.provinceCode} onChange={set("provinceCode")} options={PROVINCE_OPTIONS} placeholder="Chưa chọn" disabled={busy || locked} accent={accent} />
          </div>
          <TextField label="Địa điểm học" name="location" value={values.location} onChange={set("location")} disabled={busy || locked} maxLength={200} accent={accent} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Ngày khai giảng" name="startDate" type="date" value={values.startDate} onChange={set("startDate")} disabled={busy || locked} accent={accent} />
            <TextField label="Hạn nhận yêu cầu" name="enrollmentDeadline" type="date" value={values.enrollmentDeadline} onChange={set("enrollmentDeadline")} disabled={busy || locked} accent={accent} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Thời lượng" name="durationText" value={values.durationText} onChange={set("durationText")} disabled={busy || locked} maxLength={80} placeholder="Ví dụ: 3 tháng" accent={accent} />
            <TextField label="Học phí (VNĐ)" name="tuitionVnd" inputMode="numeric" value={values.tuitionVnd} onChange={set("tuitionVnd")} disabled={busy || locked} placeholder="Để trống nếu liên hệ" accent={accent} />
            <TextField label="Số chỗ" name="capacity" inputMode="numeric" value={values.capacity} onChange={set("capacity")} disabled={busy || locked} accent={accent} />
          </div>
          <TextAreaField label="Hỗ trợ học phí / quyền lợi" name="supportDescription" value={values.supportDescription} onChange={set("supportDescription")} disabled={busy || locked} rows={2} maxLength={1000} accent={accent} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Tên chứng chỉ" name="certificateName" value={values.certificateName} onChange={set("certificateName")} disabled={busy || locked} maxLength={160} accent={accent} />
            <TextField label="Đơn vị cấp chứng chỉ" name="certificateIssuer" value={values.certificateIssuer} onChange={set("certificateIssuer")} disabled={busy || locked} maxLength={160} accent={accent} />
          </div>

          {!verified && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
              Đơn vị chưa được Admin xác minh nên chưa gửi duyệt được. Bạn vẫn lưu nháp được.
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy || locked || !verified}
              onClick={() => save("submit")}
              className={`flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
            >
              {busy ? "Đang lưu…" : editingId ? "Lưu và gửi duyệt" : "Gửi duyệt"}
            </button>
            {editingId && (
              <button
                type="button"
                disabled={busy || locked}
                onClick={() => save("save")}
                className={`rounded-xl border px-5 py-2.5 text-[13px] font-bold transition disabled:opacity-50 ${accent.border} ${accent.text}`}
              >
                Lưu nháp
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-black/10 px-5 py-2.5 text-[13px] font-bold text-brand-navy/50"
            >
              Đóng
            </button>
          </div>
          <p className="text-[12px] leading-relaxed text-brand-navy/45">
            Khóa học gửi duyệt sẽ ở trạng thái chờ Admin duyệt trước khi hiển thị cho công nhân. Khóa đã duyệt
            muốn sửa thì phải gửi duyệt lại.
          </p>
        </div>
      </div>
    </div>
  );
}

export function TrainingCourses({ verified }: { verified: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{ initial: CourseFormValues; id: string | null } | null>(null);

  const expired = useCallback(() => router.replace(ROUTES.hocNgheDoiTacLogin), [router]);
  const list = useMobileList<CourseRow>((params) => listCourses(params), { status, q: query }, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  /** Đóng nhận yêu cầu: máy chủ đòi gửi lại toàn bộ trường nên lấy từ chính bản ghi đang hiện. */
  const close = useCallback(
    (course: CourseRow) => action.run(course.id, () => updateCourse(course.id, courseBody(courseToForm(course), "close"))),
    [action],
  );

  return (
    <>
      <PortalHeading
        title="🎓 Khóa học của tôi"
        description="Khóa mới sẽ ở trạng thái chờ Admin duyệt trước khi công khai."
        action={
          <button
            type="button"
            onClick={() => setForm({ initial: EMPTY_COURSE_FORM, id: null })}
            className={`rounded-xl px-4 py-2 text-[13px] font-extrabold transition ${accent.button}`}
          >
            + Tạo khóa học
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MobileSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder="Tìm theo tên khóa học hoặc nghề…" />
        <MobileFilterChips options={COURSE_FILTERS} active={status} onChange={setStatus} />
      </div>

      <MobileActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <MobileStateCard
            tone="error"
            title="Chưa tải được khóa học"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải khóa học…" />}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title="Chưa có khóa học trong trạng thái này" description="Bấm “Tạo khóa học” để thêm khóa đầu tiên." />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((course) => {
            const busy = action.busyId === course.id;
            const disabled = busy || action.needsReload;
            const place = text(course.location) || text(course.province_code) || "Chưa cập nhật địa điểm";
            const mode = LEARNING_MODE_LABEL[text(course.learning_mode) as "onsite"] ?? "Trực tiếp";
            return (
              <article key={course.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-extrabold text-brand-navy">{course.title}</h3>
                      <StatusPill
                        label={COURSE_STATUS_LABEL[course.status] ?? course.status}
                        tone={COURSE_STATUS_TONE[course.status] ?? "gray"}
                      />
                    </div>
                    <p className="mt-1 text-[12.5px] text-brand-navy/55">
                      {[text(course.occupation), text(course.level)].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-[12px] text-brand-navy/45">
                      {place} · {mode} · {formatTuition(course.tuition_vnd)}
                      {text(course.created_at) ? ` · gửi ${formatDate(text(course.created_at))}` : ""}
                    </p>
                    {text(course.rejection_reason) && (
                      <p className="mt-1.5 text-[12px] text-red-600">
                        Lý do cần chỉnh sửa: {text(course.rejection_reason)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {["draft", "rejected"].includes(course.status) && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setForm({ initial: courseToForm(course), id: course.id })}
                        className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.border} ${accent.text}`}
                      >
                        Chỉnh sửa và gửi duyệt
                      </button>
                    )}
                    {course.status === "approved" && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => close(course)}
                        className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                      >
                        {busy ? "Đang cập nhật…" : "Đóng nhận yêu cầu"}
                      </button>
                    )}
                    {course.status === "pending" && (
                      <span className="self-center text-[11.5px] text-brand-navy/40">Đang chờ Admin duyệt</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="khóa học" />

      {form && (
        <CourseForm
          initial={form.initial}
          editingId={form.id}
          verified={verified}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            list.reload();
          }}
        />
      )}
    </>
  );
}
