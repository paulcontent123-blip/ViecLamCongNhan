"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useInquirySubmit, validateContact } from "@/components/dichvucongnhan/hooks";
import { InquiryModal } from "@/components/dichvucongnhan/InquiryModal";
import { ConsentCheckbox, InfoRow, StateCard, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import { provinceName } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { directId, fetchDetail, submitInquiry, WorkerServiceError } from "@/lib/worker-service-client";
import {
  displayProvince,
  formatCalendarDate,
  formatTuition,
  LEARNING_MODE_LABEL,
  SHARE_CONSENT_TEXT,
  WORKER_SERVICES,
} from "@/lib/worker-services";
import type { VocationalCourse } from "@/types/worker-services";

const service = WORKER_SERVICES["hoc-nghe"];

/** Hai kiểu gửi của khóa học: nộp hồ sơ học viên, hoặc chỉ hỏi tư vấn. Khác nhau ở route và nhãn. */
type FormKind = "application" | "inquiry";

const FORM_COPY: Record<FormKind, {
  path: string;
  idKey: string;
  kicker: string;
  title: string;
  submitLabel: string;
  successTitle: string;
  successNote: string;
  disclaimer: string;
}> = {
  application: {
    path: "vocational/applications",
    idKey: "applicationId",
    kicker: "Hồ sơ học viên",
    title: "Nộp hồ sơ học viên",
    submitLabel: "Gửi hồ sơ học viên",
    successTitle: "Đã nhận hồ sơ",
    successNote: "Hồ sơ đã được gửi tới Admin; Admin sẽ liên hệ trao đổi với bạn.",
    disclaimer: "Hồ sơ giúp đơn vị đào tạo liên hệ với bạn; đây chưa phải xác nhận nhập học hoặc thanh toán.",
  },
  inquiry: {
    path: "vocational/inquiries",
    idKey: "inquiryId",
    kicker: "Yêu cầu tư vấn",
    title: "Yêu cầu tư vấn khóa học",
    submitLabel: "Gửi yêu cầu tư vấn",
    successTitle: "Đã nhận yêu cầu",
    successNote: "Admin sẽ liên hệ tư vấn cho bạn theo thông tin bạn để lại.",
    disclaimer: "Đây là yêu cầu tư vấn, chưa phải xác nhận nhập học hoặc thanh toán.",
  },
};

const EMPTY = { fullName: "", phone: "", email: "", message: "" };

function CourseForm({ course, kind, onClose }: { course: VocationalCourse; kind: FormKind; onClose: () => void }) {
  const copy = FORM_COPY[kind];
  const [values, setValues] = useState(EMPTY);
  const [share, setShare] = useState(false);
  const state = useInquirySubmit();
  const set = (key: keyof typeof EMPTY) => (value: string) => setValues((current) => ({ ...current, [key]: value }));

  function run() {
    state.submit(
      () => {
        const invalid = validateContact(values.fullName, values.phone);
        if (invalid) return invalid;
        if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
          return "Email chưa đúng định dạng.";
        }
        return null;
      },
      async () => {
        const id = await submitInquiry(
          copy.path,
          {
            courseId: course.id,
            fullName: values.fullName.trim(),
            // Máy chủ chỉ nhận 9‑12 chữ số: bỏ khoảng trắng và dấu người dùng gõ thêm.
            phone: values.phone.replace(/\D/g, ""),
            email: values.email.trim(),
            message: values.message.trim(),
            // Không tick thì không gửi trường này, đúng cách app làm (máy chủ chỉ ghi khi nhận true).
            ...(share ? { shareConsent: true } : {}),
          },
          (data) => directId(data, copy.idKey),
        );
        return id;
      },
    );
  }

  return (
    <InquiryModal
      service={service}
      kicker={copy.kicker}
      title={copy.title}
      subject={course.title}
      subjectNote={course.provider_name || "Đơn vị đào tạo"}
      state={state}
      onClose={onClose}
      onSubmit={run}
      submitLabel={copy.submitLabel}
      successTitle={copy.successTitle}
      successNote={copy.successNote}
      disclaimer={copy.disclaimer}
    >
      <TextField
        label="Họ và tên *"
        name="fullName"
        value={values.fullName}
        onChange={set("fullName")}
        disabled={state.locked}
        maxLength={120}
        accent={service.accent}
      />
      <TextField
        label="Số điện thoại *"
        name="phone"
        type="tel"
        inputMode="tel"
        value={values.phone}
        onChange={set("phone")}
        disabled={state.locked}
        maxLength={20}
        accent={service.accent}
      />
      <TextField
        label="Email (không bắt buộc)"
        name="email"
        type="email"
        inputMode="email"
        value={values.email}
        onChange={set("email")}
        disabled={state.locked}
        maxLength={254}
        accent={service.accent}
      />
      <TextAreaField
        label={kind === "application" ? "Lời nhắn (không bắt buộc)" : "Nội dung cần tư vấn"}
        name="message"
        value={values.message}
        onChange={set("message")}
        disabled={state.locked}
        maxLength={1000}
        accent={service.accent}
      />
      <ConsentCheckbox
        checked={share}
        onChange={setShare}
        text={SHARE_CONSENT_TEXT}
        disabled={state.locked}
        accent={service.accent}
      />
    </InquiryModal>
  );
}

export function VocationalCourseDetail({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<VocationalCourse | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormKind | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotFound(false);
    try {
      setCourse(
        await fetchDetail<VocationalCourse>(
          `vocational/courses/${encodeURIComponent(courseId)}`,
          "course",
          courseId,
        ),
      );
    } catch (err) {
      // 404 là khóa học đã bị gỡ hoặc đơn vị mất xác minh: nói rõ thay vì mời thử lại.
      if (err instanceof WorkerServiceError && err.status === 404) setNotFound(true);
      else setError(err instanceof Error ? err.message : "Chưa tải được khóa học.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <StateCard tone="loading" title="Đang tải chi tiết khóa học…" />;

  if (notFound) {
    return (
      <StateCard
        tone="empty"
        title="Khóa học không còn công khai"
        description="Khóa học có thể đã kết thúc tuyển sinh hoặc đơn vị đào tạo không còn được xác minh."
      />
    );
  }

  if (error || !course) {
    return <StateCard tone="error" title="Chưa tải được khóa học" description={error} onRetry={load} />;
  }

  const place = [course.location, displayProvince(course.province_code, provinceName)].filter(Boolean).join(" · ");
  const certificate = [course.certificate_name, course.certificate_issuer].filter(Boolean).join(" · ");

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <article className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-[20px] font-extrabold leading-snug text-brand-navy sm:text-[24px]">{course.title}</h2>
          <p className="mt-1.5 text-[13px] text-brand-navy/50">{course.provider_name || "Đơn vị đào tạo"}</p>

          <div className="mt-5">
            <InfoRow label="Nghề / kỹ năng" value={course.occupation} />
            <InfoRow label="Cấp độ" value={course.level} />
            <InfoRow
              label="Hình thức"
              value={course.learning_mode ? LEARNING_MODE_LABEL[course.learning_mode] ?? course.learning_mode : null}
            />
            <InfoRow label="Địa điểm" value={place || null} />
            <InfoRow label="Lịch khai giảng" value={formatCalendarDate(course.start_date)} />
            <InfoRow label="Thời lượng" value={course.duration_text} />
            <InfoRow label="Học phí" value={formatTuition(course.tuition_vnd)} />
            <InfoRow label="Hỗ trợ học phí" value={course.support_description} />
            <InfoRow label="Chứng chỉ" value={certificate || null} />
            <InfoRow label="Số chỗ" value={course.capacity == null ? null : String(course.capacity)} />
            <InfoRow label="Hạn đăng ký" value={formatCalendarDate(course.enrollment_deadline)} />
          </div>

          {course.description && (
            <>
              <h3 className="mt-6 text-[15px] font-extrabold text-brand-navy">Giới thiệu</h3>
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-brand-navy/70">
                {course.description}
              </p>
            </>
          )}

          {course.requirements && (
            <>
              <h3 className="mt-6 text-[15px] font-extrabold text-brand-navy">Điều kiện đầu vào</h3>
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-brand-navy/70">
                {course.requirements}
              </p>
            </>
          )}
        </article>

        <aside className="lg:sticky lg:top-[76px] lg:self-start">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <div className={`text-[12px] font-bold uppercase tracking-wider ${service.accent.text}`}>Đăng ký học</div>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-navy/60">
              Gửi hồ sơ để Admin liên hệ trao đổi, hoặc chỉ hỏi tư vấn nếu bạn chưa quyết định.
            </p>
            <button
              type="button"
              onClick={() => setForm("application")}
              className={`mt-4 w-full rounded-xl py-3 text-[14px] font-extrabold transition ${service.accent.button}`}
            >
              Nộp hồ sơ học viên
            </button>
            <button
              type="button"
              onClick={() => setForm("inquiry")}
              className={`mt-2.5 w-full rounded-xl border py-2.5 text-[13px] font-bold transition hover:bg-black/[0.02] ${service.accent.border} ${service.accent.text}`}
            >
              Chỉ muốn hỏi tư vấn
            </button>
            <p className="mt-3 text-[12px] leading-relaxed text-brand-navy/45">
              Hồ sơ giúp đơn vị đào tạo liên hệ với bạn; đây chưa phải xác nhận nhập học hoặc thanh toán.
            </p>
            <Link
              href={ROUTES.hocNghe}
              className="mt-4 block text-center text-[12.5px] font-semibold text-brand-navy/50 hover:text-brand-orange"
            >
              ← Xem khóa học khác
            </Link>
          </div>
        </aside>
      </div>

      {form && <CourseForm course={course} kind={form} onClose={() => setForm(null)} />}
    </>
  );
}
