"use client";

import Link from "next/link";
import { useState } from "react";
import { useServiceList } from "@/components/dichvucongnhan/hooks";
import { Chip, LoadMoreButton, ResultCount, SearchBar, StateCard } from "@/components/dichvucongnhan/ui";
import { provinceName } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { displayProvince, formatTuition, VOCATIONAL_LEVELS, WORKER_SERVICES } from "@/lib/worker-services";
import type { VocationalCourse } from "@/types/worker-services";

const service = WORKER_SERVICES["hoc-nghe"];

function CourseCard({ course }: { course: VocationalCourse }) {
  const place = [course.location, displayProvince(course.province_code, provinceName)].filter(Boolean).join(" · ");

  return (
    <Link
      href={`${ROUTES.hocNghe}/${course.id}`}
      className="flex flex-col rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px] ${service.accent.tint}`}>
          <span aria-hidden="true">🎓</span>
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold leading-snug text-brand-navy">{course.title}</h3>
          <p className="mt-1 text-[12px] text-brand-navy/45">{course.provider_name || "Đơn vị đào tạo"}</p>
        </div>
      </div>

      {(course.occupation || course.level) && (
        <p className={`mt-3 text-[13px] font-bold ${service.accent.text}`}>
          {[course.occupation, course.level].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-brand-navy/60">
        <span>⏱ {course.duration_text || "Chưa cập nhật thời lượng"}</span>
        <span>💰 {formatTuition(course.tuition_vnd)}</span>
        {place && <span>📍 {place}</span>}
      </div>

      {course.description && (
        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-brand-navy/60">{course.description}</p>
      )}

      <span className={`mt-4 text-[13px] font-bold ${service.accent.text}`}>Xem chi tiết và gửi hồ sơ →</span>
    </Link>
  );
}

export function VocationalList() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");

  const list = useServiceList<VocationalCourse>("vocational/courses", { q: query, level });

  return (
    <>
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <SearchBar
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder="Tên khóa học, nghề đào tạo…"
          label="Tìm khóa học nghề"
          accent={service.accent}
        />
        {/* CỐ Ý KHÔNG có bộ lọc tỉnh/thành ở đây, giống app. Ô "Mã tỉnh/thành" trong form khóa học của đơn vị
            đào tạo là ô nhập tự do (`TrainingCourseFormScreen`), nên `province_code` có thể là "Tp.HCM",
            "HCM" hay bất cứ chữ gì. Lọc theo mã sẽ lặng lẽ ẩn mất khóa học hợp lệ. Thuê trọ và Y tế dùng
            danh sách chọn nên vẫn lọc được. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Tất cả cấp độ" active={!level} onClick={() => setLevel("")} accent={service.accent} />
          {VOCATIONAL_LEVELS.map((item) => (
            <Chip
              key={item}
              label={item}
              active={level === item}
              onClick={() => setLevel(item)}
              accent={service.accent}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        {list.loaded && <ResultCount shown={list.items.length} total={list.total} unit="khóa học" />}

        {list.error && (
          <div className="mb-4">
            <StateCard
              tone="error"
              title="Chưa tải được khóa học"
              description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
              onRetry={list.reload}
            />
          </div>
        )}

        {list.loading && !list.items.length && !list.error && (
          <StateCard tone="loading" title="Đang tải khóa học…" />
        )}

        {list.loaded && !list.items.length && !list.loading && !list.error && (
          <StateCard
            tone="empty"
            title="Chưa có khóa học phù hợp"
            description="Thử đổi từ khóa hoặc bỏ lọc cấp độ. Danh sách chỉ gồm khóa học đã được Admin duyệt của đơn vị đã xác minh."
          />
        )}

        {list.items.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {list.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        {list.hasMore && (
          <LoadMoreButton
            loading={list.loadingMore}
            onClick={list.loadMore}
            accent={service.accent}
            label="Xem thêm khóa học"
          />
        )}
      </div>
    </>
  );
}
