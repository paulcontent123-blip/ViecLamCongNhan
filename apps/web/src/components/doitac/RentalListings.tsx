"use client";

// "Tin cho thuê" của chủ trọ: danh sách, tạo/sửa tin, quản lý ảnh và đổi trạng thái (hết phòng, ẩn, gửi duyệt lại).
//
// Quy tắc lấy từ app (xem `lib/rental-provider-portal.ts`): `action` luôn được gửi khi lưu nội dung; ảnh tải từng ảnh
// vào một tin ĐÃ tồn tại nên tin mới tạo xong mới thêm ảnh được; kết quả ghi chưa rõ thì khoá, không tự gửi lại.

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { SelectField, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import {
  MobileActionAlert,
  MobileFilterChips,
  MobilePager,
  MobileSearch,
  MobileStateCard,
} from "@/components/shared/mobileUi";
import { messageOf, useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import { formatDate } from "@/lib/format-date";
import { MobileApiError } from "@/lib/mobile-session-client";
import { PROVINCES, provinceName } from "@/lib/provinces";
import {
  createListing,
  listListings,
  setListingAvailability,
  updateListing,
  updateListingPhotos,
  uploadListingPhoto,
  type ListingRow,
} from "@/lib/rental-provider-client";
import {
  AMENITY_OPTIONS,
  AREA_QUICK_PICKS,
  CAPACITY_OPTIONS,
  EMPTY_LISTING,
  LISTING_FILTERS,
  LISTING_PHOTO_TYPES,
  LISTING_STATUS_LABEL,
  LISTING_STATUS_TONE,
  MAX_LISTING_PHOTOS,
  MAX_LISTING_PHOTO_BYTES,
  RENT_QUICK_PICKS,
  ROOM_TYPES,
  listingBody,
  listingError,
  listingToValues,
  type ListingValues,
} from "@/lib/rental-provider-portal";
import { ROUTES } from "@/lib/routes";

const accent = PORTAL_ACCENT;
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
const ROOM_OPTIONS = ROOM_TYPES.map((value) => ({ value, label: value }));
const CAPACITY_SELECT = CAPACITY_OPTIONS.map((value) => ({ value, label: `${value} người` }));

const text = (value: unknown) => (typeof value === "string" ? value : "");
const photosOf = (row: Record<string, unknown>) =>
  Array.isArray(row.photo_urls) ? row.photo_urls.filter((url): url is string => typeof url === "string") : [];
const money = (value: unknown) =>
  typeof value === "number" ? `${value.toLocaleString("vi-VN")}đ/tháng` : "";

type Editing = { id: string; status: string; photos: string[] };

function PhotoManager({
  listingId,
  photos,
  onChange,
  onUncertain,
  disabled,
}: {
  listingId: string;
  photos: string[];
  onChange: (next: string[]) => void;
  onUncertain: (message: string) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const off = busy || disabled;

  function fail(err: unknown, fallback: string) {
    setError(messageOf(err, fallback));
    // Chưa rõ ảnh đã gắn hay chưa: khoá và buộc tải lại tin, vì danh sách ảnh trong form có thể đã lệch với máy chủ.
    if (err instanceof MobileApiError && err.uncertain) onUncertain(messageOf(err, fallback));
  }

  async function upload(files: FileList | null) {
    if (!files?.length || off) return;
    setBusy(true);
    setError("");
    let current = photos;
    try {
      for (const file of Array.from(files)) {
        if (current.length >= MAX_LISTING_PHOTOS) {
          setError(`Mỗi tin chỉ có tối đa ${MAX_LISTING_PHOTOS} ảnh.`);
          break;
        }
        if (!LISTING_PHOTO_TYPES.includes(file.type)) {
          setError(`“${file.name}” không phải ảnh JPG, PNG hoặc WEBP.`);
          break;
        }
        if (file.size > MAX_LISTING_PHOTO_BYTES) {
          setError(`“${file.name}” lớn hơn ${MAX_LISTING_PHOTO_BYTES / (1024 * 1024)}MB.`);
          break;
        }
        // Từng ảnh một, đúng như app: máy chủ trả danh sách đầy đủ sau mỗi lần gắn.
        current = await uploadListingPhoto(listingId, file);
        onChange(current);
      }
    } catch (err) {
      fail(err, "Chưa tải được ảnh.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function replace(next: string[]) {
    if (off) return;
    setBusy(true);
    setError("");
    try {
      onChange(await updateListingPhotos(listingId, photos, next));
    } catch (err) {
      fail(err, "Chưa cập nhật được danh sách ảnh.");
    } finally {
      setBusy(false);
    }
  }

  const move = (index: number, delta: number) => {
    const next = [...photos];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    replace(next);
  };

  return (
    <div className="rounded-lg border border-black/5 bg-[#f6f7f9] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] font-bold text-brand-navy">
          Ảnh phòng ({photos.length}/{MAX_LISTING_PHOTOS})
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept={LISTING_PHOTO_TYPES.join(",")}
          disabled={off || photos.length >= MAX_LISTING_PHOTOS}
          onChange={(event) => upload(event.target.files)}
          className="max-w-[260px] text-[12px] text-brand-navy/60 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-orange-light file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-brand-orange"
        />
      </div>
      <p className="mt-1 text-[11.5px] text-brand-navy/45">
        JPG, PNG hoặc WEBP, mỗi ảnh tối đa 4MB. Ảnh đầu tiên là ảnh đại diện của tin.
      </p>
      {busy && <p className="mt-1.5 text-[11.5px] text-brand-navy/55">Đang xử lý ảnh…</p>}
      {error && (
        <p className="mt-1.5 text-[12px] font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {photos.map((url, index) => (
            <div key={url} className="overflow-hidden rounded-lg border border-black/5 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh từ kho lưu trữ ngoài, không qua tối ưu hoá của Next */}
              <img src={url} alt={`Ảnh phòng ${index + 1}`} className="h-24 w-full object-cover" />
              <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                <span className="text-[11px] font-semibold text-brand-navy/45">{index === 0 ? "Đại diện" : `#${index + 1}`}</span>
                <span className="flex gap-0.5">
                  <button type="button" disabled={off || index === 0} onClick={() => move(index, -1)} aria-label="Đưa lên trước" className="rounded px-1.5 py-0.5 text-[12px] hover:bg-black/5 disabled:opacity-30">
                    ←
                  </button>
                  <button type="button" disabled={off || index === photos.length - 1} onClick={() => move(index, 1)} aria-label="Đưa ra sau" className="rounded px-1.5 py-0.5 text-[12px] hover:bg-black/5 disabled:opacity-30">
                    →
                  </button>
                  <button
                    type="button"
                    disabled={off}
                    onClick={() => replace(photos.filter((_, i) => i !== index))}
                    aria-label="Xoá ảnh"
                    className="rounded px-1.5 py-0.5 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ListingForm({
  initial,
  editing: start,
  verified,
  onClose,
  onChanged,
}: {
  initial: ListingValues;
  editing: Editing | null;
  verified: boolean;
  onClose: () => void;
  onChanged: (message?: string) => void;
}) {
  const [values, setValues] = useState(initial);
  const [editing, setEditing] = useState(start);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  /** Kết quả ghi chưa rõ: khoá mọi nút cho tới khi đóng form và tải lại danh sách. */
  const [locked, setLocked] = useState(false);
  const off = busy || locked;
  const set = <K extends keyof ListingValues>(key: K) => (value: ListingValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function save(action: "draft" | "submit") {
    if (off) return;
    const invalid = listingError(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (action === "draft" && editing?.status === "approved" && !window.confirm("Lưu nháp sẽ gỡ tin khỏi trang công khai cho tới khi bạn gửi duyệt lại. Tiếp tục?")) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = listingBody(values, action);
      if (editing) {
        const saved = await updateListing(editing.id, body);
        setEditing({ ...editing, status: saved.status });
        setNotice(saved.status === "pending" ? "Đã gửi tin chờ Admin duyệt." : "Đã lưu tin.");
        onChanged();
      } else {
        const created = await createListing(body);
        setEditing({ id: created.id, status: created.status, photos: [] });
        setNotice("Đã tạo tin. Thêm ảnh phòng ở bên dưới (nên có ít nhất 3 ảnh).");
        onChanged();
      }
    } catch (err) {
      setError(messageOf(err, "Chưa lưu được tin."));
      if (err instanceof MobileApiError && err.uncertain) setLocked(true);
    } finally {
      setBusy(false);
    }
  }

  const toggleAmenity = (name: string) =>
    set("amenityPicks")(values.amenityPicks.includes(name) ? values.amenityPicks.filter((x) => x !== name) : [...values.amenityPicks, name]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-brand-navy/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="my-6 w-full max-w-[760px] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4">
          <h2 className="text-[17px] font-extrabold text-brand-navy">{editing ? "Sửa tin cho thuê" : "Đăng tin cho thuê"}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng form" className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 hover:bg-black/5">
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3.5 p-5">
          <TextField label="Tiêu đề tin *" name="title" value={values.title} onChange={set("title")} maxLength={160} disabled={off} accent={accent} />
          <TextAreaField label="Mô tả *" name="description" value={values.description} onChange={set("description")} rows={4} maxLength={4000} disabled={off} accent={accent} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <TextField label="Giá thuê (đồng/tháng) *" name="rent" value={values.monthlyRentVnd} onChange={(v) => set("monthlyRentVnd")(v.replace(/\D/g, ""))} inputMode="numeric" disabled={off} accent={accent} />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {RENT_QUICK_PICKS.map((amount) => (
                  <button key={amount} type="button" disabled={off} onClick={() => set("monthlyRentVnd")(String(amount))} className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${accent.border} ${accent.text} disabled:opacity-40`}>
                    {amount.toLocaleString("vi-VN")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <TextField label="Diện tích (m²)" name="area" value={values.areaSqm} onChange={(v) => set("areaSqm")(v.replace(/[^\d.]/g, ""))} inputMode="numeric" disabled={off} accent={accent} />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {AREA_QUICK_PICKS.map((area) => (
                  <button key={area} type="button" disabled={off} onClick={() => set("areaSqm")(String(area))} className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${accent.border} ${accent.text} disabled:opacity-40`}>
                    {area}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Tỉnh/thành *" name="province" value={values.provinceCode} onChange={set("provinceCode")} options={PROVINCE_OPTIONS} placeholder="Chọn tỉnh/thành" disabled={off} accent={accent} />
            <TextField label="Địa điểm *" name="location" value={values.location} onChange={set("location")} maxLength={200} placeholder="Phường/xã, đường…" disabled={off} accent={accent} />
          </div>
          <TextField label="Gần khu công nghiệp" name="zone" value={values.nearbyIndustrialZone} onChange={set("nearbyIndustrialZone")} maxLength={160} disabled={off} accent={accent} />

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Loại phòng" name="roomType" value={values.roomType} onChange={set("roomType")} options={ROOM_OPTIONS} placeholder="Chưa chọn" disabled={off} accent={accent} />
            <SelectField label="Sức chứa" name="capacity" value={values.capacity} onChange={set("capacity")} options={CAPACITY_SELECT} placeholder="Chưa chọn" disabled={off} accent={accent} />
          </div>

          <fieldset>
            <legend className="text-[12px] font-semibold text-brand-navy/60">Tiện ích</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((name) => {
                const on = values.amenityPicks.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={off}
                    aria-pressed={on}
                    onClick={() => toggleAmenity(name)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition disabled:opacity-40 ${on ? `${accent.button} border-transparent` : "border-black/10 text-brand-navy/60"}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              <TextField label="Tiện ích khác (cách nhau bằng dấu phẩy)" name="amenitiesText" value={values.amenitiesText} onChange={set("amenitiesText")} maxLength={300} disabled={off} accent={accent} />
            </div>
          </fieldset>

          {editing ? (
            <PhotoManager
              listingId={editing.id}
              photos={editing.photos}
              disabled={locked || busy}
              onChange={(photos) => {
                setEditing((current) => (current ? { ...current, photos } : current));
                onChanged();
              }}
              onUncertain={(message) => {
                setError(message);
                setLocked(true);
              }}
            />
          ) : (
            <p className="rounded-lg bg-[#f6f7f9] px-3 py-2.5 text-[12.5px] text-brand-navy/55">
              Lưu tin trước, sau đó thêm ảnh phòng. Ảnh được tải lên từng tấm vào tin đã tạo.
            </p>
          )}

          {editing?.status === "approved" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-800">
              Tin đang công khai: để thay đổi nội dung được hiển thị, hãy bấm “Lưu và gửi duyệt”; tin sẽ chờ Admin duyệt lại.
            </p>
          )}
          {!verified && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-800">
              Chưa được Admin xác minh nên chỉ lưu nháp được, chưa gửi duyệt được.
            </p>
          )}

          {notice && <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-[12.5px] font-medium text-emerald-800" role="status">{notice}</div>}
          {error && <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">{error}</div>}
          {locked && <p className="text-[12px] text-amber-800">Đóng form rồi tải lại danh sách trước khi thao tác tiếp.</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" disabled={off || !verified} title={!verified ? "Cần Admin xác minh mới gửi duyệt được" : undefined} onClick={() => save("submit")} className={`flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold transition disabled:opacity-50 ${accent.button}`}>
              {busy ? "Đang lưu…" : "Lưu và gửi duyệt"}
            </button>
            <button type="button" disabled={off} onClick={() => save("draft")} className={`rounded-xl border px-5 py-2.5 text-[13px] font-bold disabled:opacity-50 ${accent.border} ${accent.text}`}>
              Lưu nháp
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-black/10 px-5 py-2.5 text-[13px] font-bold text-brand-navy/50">
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RentalListings({ verified }: { verified: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{ initial: ListingValues; editing: Editing | null } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const expired = useCallback(() => router.replace(ROUTES.thueTroDoiTacLogin), [router]);
  const list = useMobileList<ListingRow>((params) => listListings(params as Parameters<typeof listListings>[0]), { status, q: query }, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  const open = (initial: ListingValues, editing: Editing | null) => {
    setFormKey((key) => key + 1);
    setForm({ initial, editing });
  };

  const statusChange = (row: ListingRow, next: "full" | "hidden") =>
    action.run(row.id, async () => {
      await setListingAvailability(row.id, next);
    });

  const resubmit = (row: ListingRow) =>
    action.run(row.id, async () => {
      // Gửi lại đúng nội dung hiện có để duyệt; `action: "submit"` là cách duy nhất đưa tin về "Chờ duyệt".
      await updateListing(row.id, { action: "submit" });
    });

  return (
    <>
      <PortalHeading
        title="🏠 Tin cho thuê"
        description="Đăng tin phòng trọ, thêm ảnh và theo dõi duyệt. Tin chỉ hiển thị công khai sau khi Admin duyệt."
        action={
          <button type="button" disabled={action.needsReload} onClick={() => open(EMPTY_LISTING, null)} className={`rounded-xl px-4 py-2 text-[13px] font-extrabold transition disabled:opacity-50 ${accent.button}`}>
            + Đăng tin
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MobileSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder="Tìm theo tiêu đề…" />
        <MobileFilterChips options={LISTING_FILTERS} active={status} onChange={setStatus} />
      </div>

      <MobileActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <MobileStateCard tone="error" title="Chưa tải được tin cho thuê" description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error} onRetry={list.reload} />
        </div>
      )}
      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải tin cho thuê…" />}
      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title="Chưa có tin trong trạng thái này" description="Bấm “Đăng tin” để thêm tin đầu tiên." />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((row) => {
            const busy = action.busyId === row.id;
            const disabled = busy || action.needsReload;
            const photos = photosOf(row);
            const place = [text(row.location), provinceName(text(row.province_code)) || text(row.province_code)].filter(Boolean).join(", ");
            return (
              <article key={row.id} className="flex gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="hidden h-[84px] w-[110px] shrink-0 overflow-hidden rounded-lg bg-[#f6f7f9] sm:block">
                  {photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh từ kho lưu trữ ngoài
                    <img src={photos[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-brand-navy/35">Chưa có ảnh</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-extrabold text-brand-navy">{row.title}</h3>
                    <StatusPill label={LISTING_STATUS_LABEL[row.status] ?? row.status} tone={LISTING_STATUS_TONE[row.status] ?? "gray"} />
                  </div>
                  <p className={`mt-1 text-[12.5px] font-semibold ${accent.text}`}>{[money(row.monthly_rent_vnd), text(row.room_type)].filter(Boolean).join(" · ")}</p>
                  {place && <p className="mt-0.5 text-[12.5px] text-brand-navy/55">{place}</p>}
                  <p className="mt-0.5 text-[11.5px] text-brand-navy/40">
                    {photos.length} ảnh{text(row.created_at) ? ` · Tạo ${formatDate(text(row.created_at))}` : ""}
                  </p>
                  {text(row.rejection_reason) && <p className="mt-1.5 text-[12px] text-red-600">Lý do từ chối: {text(row.rejection_reason)}</p>}

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" disabled={disabled} onClick={() => open(listingToValues(row), { id: row.id, status: row.status, photos })} className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.border} ${accent.text}`}>
                      Sửa & ảnh
                    </button>
                    {row.status === "approved" && (
                      <button type="button" disabled={disabled} onClick={() => statusChange(row, "full")} className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 disabled:opacity-40">
                        Đánh dấu hết phòng
                      </button>
                    )}
                    {(row.status === "approved" || row.status === "full") && (
                      <button type="button" disabled={disabled} onClick={() => statusChange(row, "hidden")} className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 disabled:opacity-40">
                        Ẩn tin
                      </button>
                    )}
                    {(row.status === "hidden" || row.status === "full" || row.status === "rejected") && (
                      <button type="button" disabled={disabled || !verified} title={!verified ? "Cần Admin xác minh mới gửi duyệt được" : undefined} onClick={() => resubmit(row)} className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 disabled:opacity-40">
                        {busy ? "Đang gửi…" : row.status === "rejected" ? "Gửi duyệt lại" : "Mở lại (gửi duyệt)"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="tin" />

      {form && (
        <ListingForm
          key={formKey}
          initial={form.initial}
          editing={form.editing}
          verified={verified}
          onClose={() => {
            setForm(null);
            list.reload();
          }}
          onChanged={() => list.reload()}
        />
      )}
    </>
  );
}
