"use client";

import { useState } from "react";
import { OTHER_INDUSTRY_VALUE } from "@/lib/industries";

interface IndustryOption {
  value: string;
  label: string;
}

/** Select ngành nghề dùng cho form LỌC gửi bằng GET (Tìm việc, Duyệt hồ sơ ứng viên)
 * ‑ không controlled bằng React state, submit thẳng qua thuộc tính name như select
 * thường. Khi chọn "Ngành nghề khác", select tự bỏ `name` (trình duyệt bỏ qua lúc
 * submit) và nhường chỗ cho ô nhập text mang đúng `name` đó, nên form GET vẫn chỉ có
 * đúng 1 giá trị `industry` trong query string dù dùng 2 input khác nhau. */
export function IndustryFilterSelect({
  name,
  defaultValue,
  options,
  allLabel = "Tất cả ngành",
  className,
}: {
  name: string;
  defaultValue: string;
  options: readonly IndustryOption[];
  allLabel?: string;
  className: string;
}) {
  const isKnown = defaultValue === "" || options.some((o) => o.value === defaultValue);
  const [isOther, setIsOther] = useState(!isKnown);

  return (
    <>
      <select
        name={isOther ? undefined : name}
        defaultValue={isOther ? OTHER_INDUSTRY_VALUE : defaultValue}
        onChange={(e) => setIsOther(e.target.value === OTHER_INDUSTRY_VALUE)}
        className={className}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={OTHER_INDUSTRY_VALUE}>✏️ Ngành nghề khác</option>
      </select>
      {isOther && (
        <input
          type="text"
          name={name}
          defaultValue={isKnown ? "" : defaultValue}
          maxLength={80}
          placeholder="Nhập ngành nghề để lọc..."
          className={`mt-2 ${className}`}
        />
      )}
    </>
  );
}
