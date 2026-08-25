"use client";

import { useState } from "react";
import { OTHER_INDUSTRY_VALUE } from "@/lib/industries";

interface IndustryOption {
  value: string;
  label: string;
}

const DEFAULT_CLASS =
  "mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange";

/** Select ngành nghề dùng chung cho form "tự mô tả" (đăng tin, hồ sơ ứng viên, hồ sơ
 * công ty...) — controlled, `value` là giá trị THẬT sẽ gửi lên server (slug chuẩn
 * hoặc text NTD/ứng viên tự gõ khi chọn "Ngành nghề khác"), không bao giờ là sentinel
 * OTHER_INDUSTRY_VALUE. */
export function IndustrySelect({
  value,
  onChange,
  options,
  placeholder = "-- Chọn ngành --",
  required = false,
  className = DEFAULT_CLASS,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly IndustryOption[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const isKnown = value === "" || options.some((o) => o.value === value);
  const [isOther, setIsOther] = useState(!isKnown);

  return (
    <div>
      <select
        value={isOther ? OTHER_INDUSTRY_VALUE : value}
        onChange={(e) => {
          if (e.target.value === OTHER_INDUSTRY_VALUE) {
            setIsOther(true);
            onChange("");
          } else {
            setIsOther(false);
            onChange(e.target.value);
          }
        }}
        required={required}
        className={className}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={OTHER_INDUSTRY_VALUE}>✏️ Ngành nghề khác (tự nhập)</option>
      </select>
      {isOther && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={80}
          placeholder="Nhập tên ngành nghề..."
          className={`mt-2 ${className}`}
        />
      )}
    </div>
  );
}
