"use client";

// Lưới ô nhập dựng theo cấu hình, dùng chung cho form đăng ký, hồ sơ và sản phẩm của các cổng đối tác.
// Mỗi cổng chỉ khai báo danh sách `FieldDef` thay vì viết lại từng ô; các ô đánh dấu `half` được xếp thành
// từng cặp hai cột (trên màn nhỏ tự thành một cột).

import { SelectField, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import type { FieldDef } from "@/lib/provider-portal-common";
import type { WorkerServiceMeta } from "@/lib/worker-services";

export type ProviderAccent = WorkerServiceMeta["accent"];

export type { FieldDef };

export type FieldValues = Record<string, string>;

function renderField(
  def: FieldDef,
  values: FieldValues,
  set: (key: string) => (value: string) => void,
  disabled: boolean,
  accent: ProviderAccent,
) {
  const common = { name: def.key, label: def.label, value: values[def.key] ?? "", onChange: set(def.key), disabled, accent };
  let control: React.ReactNode;
  if (def.kind === "select") {
    control = <SelectField {...common} options={def.options ?? []} placeholder={def.placeholder} />;
  } else if (def.kind === "textarea") {
    control = <TextAreaField {...common} rows={def.rows ?? 3} maxLength={def.maxLength} placeholder={def.placeholder} />;
  } else {
    control = (
      <TextField
        {...common}
        type={def.kind ?? "text"}
        inputMode={def.inputMode}
        maxLength={def.maxLength}
        placeholder={def.placeholder}
      />
    );
  }
  return (
    <div key={def.key}>
      {control}
      {def.hint && <p className="mt-1 text-[12px] leading-relaxed text-brand-navy/45">{def.hint}</p>}
    </div>
  );
}

export function FieldGrid({
  fields,
  values,
  onChange,
  disabled = false,
  accent,
}: {
  fields: FieldDef[];
  values: FieldValues;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  accent: ProviderAccent;
}) {
  const set = (key: string) => (value: string) => onChange(key, value);

  // Gom các ô `half` liên tiếp thành từng cặp; ô lẻ cuối chuỗi vẫn chiếm nửa hàng rồi xuống dòng.
  const rows: FieldDef[][] = [];
  let pending: FieldDef[] = [];
  for (const def of fields) {
    if (def.half) {
      pending.push(def);
      if (pending.length === 2) {
        rows.push(pending);
        pending = [];
      }
    } else {
      if (pending.length) {
        rows.push(pending);
        pending = [];
      }
      rows.push([def]);
    }
  }
  if (pending.length) rows.push(pending);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) =>
        row.length === 1 && !row[0].half ? (
          renderField(row[0], values, set, disabled, accent)
        ) : (
          <div key={row.map((def) => def.key).join("+")} className="grid gap-3 sm:grid-cols-2">
            {row.map((def) => renderField(def, values, set, disabled, accent))}
          </div>
        ),
      )}
    </div>
  );
}
