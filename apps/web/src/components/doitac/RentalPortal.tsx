"use client";

// Các màn của cổng Chủ trọ: ghép cấu hình riêng của cổng vào các component dùng chung, cộng Kho người thuê.

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SelectField } from "@/components/dichvucongnhan/ui";
import { ProviderLoginForm, ProviderRegisterForm } from "@/components/doitac/ProviderAuthForms";
import { ProviderBooked } from "@/components/doitac/ProviderBooked";
import { ProviderInquiries } from "@/components/doitac/ProviderInquiries";
import { ProviderOrders } from "@/components/doitac/ProviderOrders";
import { ProviderOverview } from "@/components/doitac/ProviderOverview";
import { ProviderProfile } from "@/components/doitac/ProviderProfile";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { loadProviderOverview } from "@/components/doitac/providerOverviewLoader";
import { MobileActionAlert, MobilePager, MobileSearch, MobileStateCard } from "@/components/shared/mobileUi";
import { useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import type { MobileQuery } from "@/lib/mobile-session-client";
import { inquiryFilters, RENTAL_INQUIRY_STATUSES, RENTAL_INQUIRY_TRANSITIONS } from "@/lib/provider-portal-common";
import { PROVINCES, provinceName } from "@/lib/provinces";
import {
  getProfile,
  listBooked,
  listInquiries,
  listListings,
  listTenants,
  login,
  openInquiryContact,
  openTenantContact,
  register,
  rentalApi,
  saveProfile,
  updateInquiryStatus,
  uploadLogo,
  type TenantRow,
} from "@/lib/rental-provider-client";
import {
  LISTING_STATUS_LABEL,
  LISTING_STATUS_TONE,
  RENTAL_INQUIRY_LABEL,
  RENTAL_INQUIRY_TONE,
  RENTAL_PROFILE_FIELDS,
  RENTAL_REGISTER_FIELDS,
  RENTAL_REGISTER_INITIAL,
  rentalProfileBody,
  rentalProfileError,
  rentalProfileMatches,
  rentalProfileToValues,
  rentalRegisterBody,
  rentalRegisterError,
} from "@/lib/rental-provider-portal";
import { ROUTES } from "@/lib/routes";
import { displayProvince } from "@/lib/worker-services";

const accent = PORTAL_ACCENT;
const loginHref = ROUTES.thueTroDoiTacLogin;
const text = (value: unknown) => (typeof value === "string" ? value : "");

type ListParams = Parameters<typeof listInquiries>[0];
const asParams = (params: MobileQuery) => params as ListParams;
const subject = (row: Record<string, unknown>) => {
  const listing = row.rental_listings as { title?: unknown; location?: unknown } | null;
  return [text(listing?.title), text(listing?.location)].filter(Boolean).join(" · ");
};

export function RentalLoginForm() {
  return (
    <ProviderLoginForm
      icon="🏠"
      title="Đăng nhập chủ trọ"
      accent={accent}
      login={login}
      dashboardHref={ROUTES.thueTroDoiTacDashboard}
      registerHref={ROUTES.thueTroDoiTac}
      registerLabel="Chưa có tài khoản? Đăng ký chủ trọ"
    />
  );
}

export function RentalRegisterForm() {
  return (
    <ProviderRegisterForm
      title="Đăng ký chủ trọ"
      intro="Tạo tài khoản để đăng tin cho thuê và nhận yêu cầu từ công nhân."
      accent={accent}
      fields={RENTAL_REGISTER_FIELDS}
      initialValues={RENTAL_REGISTER_INITIAL}
      validate={rentalRegisterError}
      buildBody={rentalRegisterBody}
      register={register}
      loginHref={loginHref}
      successTitle="Đã gửi đăng ký"
      successNote="Tài khoản đã được tạo. Bạn đăng nhập được ngay để hoàn thiện hồ sơ; Admin xác minh trước khi bạn gửi tin duyệt và mở liên hệ."
    />
  );
}

export function RentalOverview() {
  return (
    <ProviderOverview
      portal="rental"
      loginHref={loginHref}
      kicker="Đối tác thuê trọ"
      gradient="from-brand-orange to-brand-orange-2"
      statLabels={["Tin chờ duyệt", "Yêu cầu mới", "Tổng tin", "Tổng yêu cầu"]}
      statClass="text-brand-orange"
      unverifiedMessage="Tin chỉ lưu được ở trạng thái Nháp và chưa mở được liên hệ. Admin cần xác minh tài khoản trước."
      tilesTitle="Quản lý chủ trọ"
      load={() =>
        loadProviderOverview({
          getProfile,
          listItems: (params) => listListings(params as Parameters<typeof listListings>[0]),
          listInquiries: (params) => listInquiries(asParams(params)),
          itemNoun: "Tin cho thuê",
          itemLabel: LISTING_STATUS_LABEL,
          itemTone: LISTING_STATUS_TONE,
          itemHref: ROUTES.thueTroDoiTacListings,
          inquiryType: "Yêu cầu thuê",
          inquiryLabel: RENTAL_INQUIRY_LABEL,
          inquiryTone: RENTAL_INQUIRY_TONE,
          inquiryHref: ROUTES.thueTroDoiTacInquiries,
          inquirySubject: subject,
          subtitle: (profile) => {
            const tier = text(profile.account_type) || "free";
            const limit = typeof profile.contact_view_limit === "number" ? profile.contact_view_limit : 0;
            return `Gói ${tier} · Hạn mức mở liên hệ: ${limit.toLocaleString("vi-VN")} lượt/tháng${profile.email ? ` · ${profile.email}` : ""}`;
          },
        })
      }
    />
  );
}

export function RentalInquiries() {
  return (
    <ProviderInquiries
      loginHref={loginHref}
      accent={accent}
      title="📨 Yêu cầu thuê"
      description="Công nhân quan tâm tin cho thuê của bạn. Số điện thoại chỉ mở theo hạn mức tháng của gói."
      searchPlaceholder="Tìm theo tên người gửi…"
      labels={RENTAL_INQUIRY_LABEL}
      tones={RENTAL_INQUIRY_TONE}
      filters={inquiryFilters(RENTAL_INQUIRY_STATUSES, RENTAL_INQUIRY_LABEL)}
      transitions={RENTAL_INQUIRY_TRANSITIONS}
      listInquiries={(params) => listInquiries(asParams(params))}
      updateInquiryStatus={updateInquiryStatus}
      openInquiryContact={openInquiryContact}
      subject={subject}
    />
  );
}

export function RentalOrders() {
  return (
    <ProviderOrders
      api={rentalApi.orders}
      loginHref={loginHref}
      accent={accent}
      title="💳 Gói & đơn hàng"
      description="Mua gói Basic hoặc Premium để có thêm lượt mở liên hệ mỗi tháng và theo dõi thanh toán."
      limitKey="tenantContactLimit"
      limitText="lượt mở liên hệ mỗi tháng"
    />
  );
}

export function RentalProfile() {
  return (
    <ProviderProfile
      loginHref={loginHref}
      accent={accent}
      title="👤 Hồ sơ đối tác"
      description="Thông tin chủ trọ / đơn vị cho thuê và logo hiển thị cùng tin."
      fields={RENTAL_PROFILE_FIELDS}
      getProfile={getProfile}
      saveProfile={saveProfile}
      toValues={rentalProfileToValues}
      validate={rentalProfileError}
      buildBody={rentalProfileBody}
      matches={rentalProfileMatches}
      uploadLogo={uploadLogo}
      logoAccept="image/jpeg,image/png,image/webp"
      logoHint="JPG, PNG hoặc WEBP, tối đa 5MB."
      logoAlt="Logo chủ trọ"
      fileButtonClass="file:bg-brand-orange-light file:text-brand-orange"
      sideRows={(profile) => [
        { label: "Email", value: profile.email || "—" },
        { label: "Gói", value: text(profile.account_type) || "free" },
        {
          label: "Hạn mức liên hệ",
          value: `${(typeof profile.contact_view_limit === "number" ? profile.contact_view_limit : 0).toLocaleString("vi-VN")}/tháng`,
        },
      ]}
      verificationLostMessage="Đã cập nhật hồ sơ. Vì thông tin thay đổi, Admin cần xác minh lại; trong thời gian đó tin chỉ lưu được ở trạng thái Nháp và chưa mở được liên hệ."
    />
  );
}

export function RentalBooked() {
  return <ProviderBooked listBooked={listBooked} loginHref={loginHref} />;
}

// ───────── Kho người thuê ─────────

type Contact = { phone: string; email: string | null; zalo: string | null; viewedCount: number; viewLimit: number };

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
// Máy chủ lọc tỉnh bằng so khớp chữ ở hồ sơ công nhân tự khai, nên gửi TÊN tỉnh chứ không gửi mã.
const PROVINCE_BY_NAME = PROVINCE_OPTIONS.map((option) => ({ value: option.label, label: option.label }));

function usageFrom(extra: Record<string, unknown>) {
  const usage = extra.usage as Record<string, unknown> | undefined;
  if (!usage || typeof usage.verified !== "boolean") return null;
  return {
    verified: usage.verified,
    viewLimit: Number.isSafeInteger(usage.viewLimit) ? (usage.viewLimit as number) : 0,
    viewedCount: Number.isSafeInteger(usage.viewedCount) ? (usage.viewedCount as number) : 0,
  };
}

export function RentalTenants() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  const [contacts, setContacts] = useState<Record<string, Contact>>({});

  const expired = useCallback(() => router.replace(loginHref), [router]);
  const list = useMobileList<TenantRow>(
    (params) => listTenants(params as Parameters<typeof listTenants>[0]),
    { q: query, province },
    { onSessionExpired: expired },
  );
  const action = useMobileAction(list.reload, expired);

  const usage = usageFrom(list.extra);
  const remaining = usage ? Math.max(0, usage.viewLimit - usage.viewedCount) : 0;

  const openContact = useCallback(
    (row: TenantRow) => {
      if (!window.confirm("Mở số điện thoại người này? Lượt mở được tính vào hạn mức tháng; mở lại trong tháng không tính thêm.")) return;
      action.run(row.id, async () => {
        const result = await openTenantContact(row.id);
        setContacts((current) => ({ ...current, [row.id]: result }));
      });
    },
    [action],
  );

  const note = !usage
    ? "Đang kiểm tra hạn mức…"
    : !usage.verified
      ? "Tài khoản chưa được Admin xác minh nên chưa mở được liên hệ."
      : usage.viewLimit === 0
        ? "Gói hiện tại không có lượt mở liên hệ. Nâng gói ở mục Gói & đơn hàng."
        : `Đã dùng ${usage.viewedCount}/${usage.viewLimit} lượt mở liên hệ trong tháng (còn ${remaining}). Mở lại người đã xem trong tháng không trừ thêm lượt.`;

  return (
    <>
      <PortalHeading
        title="🔎 Kho người thuê"
        description="Hồ sơ công nhân đã đồng ý chia sẻ cho chủ trọ. Danh sách hiện ẩn danh; mở liên hệ từng người theo hạn mức."
      />

      <div className={`mb-4 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed ${accent.tint}`}>{note}</div>

      <div className="mb-4 rounded-xl border border-black/5 bg-white p-4">
        <MobileSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder="Tìm theo tên hoặc ngành nghề…" />
        <div className="mt-3 max-w-sm">
          <SelectField label="Tỉnh/thành" name="province" value={province} onChange={setProvince} options={PROVINCE_BY_NAME} placeholder="Tất cả tỉnh/thành" accent={accent} />
        </div>
      </div>

      <MobileActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <MobileStateCard tone="error" title="Chưa tải được Kho người thuê" description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error} onRetry={list.reload} />
        </div>
      )}
      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải hồ sơ…" />}
      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title="Chưa có hồ sơ phù hợp" description="Thử bỏ bộ lọc tỉnh/thành. Kho chỉ gồm công nhân đã đồng ý chia sẻ thông tin cho chủ trọ." />
      )}

      {list.items.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.items.map((row) => {
            const busy = action.busyId === row.id;
            const contact = contacts[row.id];
            const place = displayProvince(text(row.province), provinceName);
            const years = Number.isSafeInteger(row.experience_years) ? (row.experience_years as number) : null;
            const meta = [text(row.desired_industry) || "Chưa cung cấp ngành", place, years === null ? null : `${years} năm kinh nghiệm`].filter(Boolean);
            return (
              <article key={row.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <h3 className="text-[14px] font-extrabold text-brand-navy">{row.full_name}</h3>
                <p className="mt-1 text-[12.5px] text-brand-navy/55">{meta.join(" · ")}</p>
                {contact ? (
                  <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
                    <a href={`tel:${contact.phone}`} className="font-extrabold underline">{contact.phone}</a>
                    {contact.zalo ? <span> · Zalo {contact.zalo}</span> : null}
                    <div className="mt-0.5 text-[11.5px] text-emerald-700/80">
                      Đã dùng {contact.viewedCount}/{contact.viewLimit} lượt trong tháng
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy || action.needsReload || (usage !== null && (!usage.verified || remaining <= 0))}
                    title={usage && usage.verified && remaining <= 0 ? "Đã dùng hết hạn mức mở liên hệ trong tháng" : undefined}
                    onClick={() => openContact(row)}
                    className={`mt-3 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.button}`}
                  >
                    {busy ? "Đang mở…" : "Mở liên hệ"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="hồ sơ" />
    </>
  );
}
