"use client";

// Các màn của cổng Đơn vị tài chính: ghép cấu hình riêng của cổng vào các component dùng chung.
// Khác Bảo hiểm ở hai điểm: sản phẩm có "Lưu trữ" (kèm mốc phiên bản chống ghi đè), và hồ sơ giấy phép tải lên kho riêng.

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useRef, useState } from "react";
import { ProviderLoginForm, ProviderRegisterForm } from "@/components/doitac/ProviderAuthForms";
import { ProviderBooked } from "@/components/doitac/ProviderBooked";
import { ProviderInquiries } from "@/components/doitac/ProviderInquiries";
import { ProviderOrders } from "@/components/doitac/ProviderOrders";
import { ProviderOverview } from "@/components/doitac/ProviderOverview";
import { ProviderProducts } from "@/components/doitac/ProviderProducts";
import { ProviderProfile, type ProfileExtraContext } from "@/components/doitac/ProviderProfile";
import { loadProviderOverview } from "@/components/doitac/providerOverviewLoader";
import { messageOf } from "@/components/shared/useMobileList";
import {
  archiveProduct,
  createProduct,
  financeApi,
  getProfile,
  listBooked,
  listInquiries,
  listProducts,
  login,
  openInquiryContact,
  register,
  saveProfile,
  updateInquiryStatus,
  updateProduct,
  uploadLicenseEvidence,
  uploadLogo,
} from "@/lib/finance-provider-client";
import {
  FINANCE_PRODUCT_EMPTY,
  FINANCE_PRODUCT_FIELDS,
  FINANCE_REGISTER_FIELDS,
  FINANCE_REGISTER_INITIAL,
  financeProductBody,
  financeProductError,
  financeProductMeta,
  financeProductToValues,
  financeProfileBody,
  financeProfileError,
  financeProfileFields,
  financeProfileMatches,
  financeProfileToValues,
  financeRegisterBody,
  financeRegisterError,
  isPrivateEvidence,
} from "@/lib/finance-provider-portal";
import { MobileApiError, type MobileQuery } from "@/lib/mobile-session-client";
import {
  CONSULT_INQUIRY_LABEL,
  CONSULT_INQUIRY_STATUSES,
  CONSULT_INQUIRY_TONE,
  CONSULT_INQUIRY_TRANSITIONS,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  inquiryFilters,
} from "@/lib/provider-portal-common";
import { provinceName } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";

const accent = PORTAL_ACCENT;
const loginHref = ROUTES.taiChinhDoiTacLogin;
const text = (value: unknown) => (typeof value === "string" ? value : "");

type ListParams = { status?: string; q?: string; page?: number; pageSize?: number };
const asParams = (params: MobileQuery) => params as ListParams;
const subject = (row: Record<string, unknown>) => text((row.finance_products as { title?: unknown } | null)?.title);

const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

export function FinanceLoginForm() {
  return (
    <ProviderLoginForm
      icon="💰"
      title="Đăng nhập đối tác tài chính"
      accent={accent}
      login={login}
      dashboardHref={ROUTES.taiChinhDoiTacDashboard}
      registerHref={ROUTES.taiChinhDoiTac}
      registerLabel="Chưa có tài khoản? Đăng ký đối tác"
    />
  );
}

export function FinanceRegisterForm() {
  return (
    <ProviderRegisterForm
      title="Đăng ký đối tác tài chính"
      intro="Tạo tài khoản cho tổ chức tài chính, ứng lương hoặc chuyển tiền. Cần số giấy phép và liên kết hồ sơ chứng minh."
      accent={accent}
      fields={FINANCE_REGISTER_FIELDS}
      initialValues={FINANCE_REGISTER_INITIAL}
      validate={financeRegisterError}
      buildBody={financeRegisterBody}
      register={register}
      loginHref={loginHref}
      successTitle="Đã gửi đăng ký"
      successNote="Tài khoản đã được tạo. Admin sẽ đối chiếu giấy phép trước khi xác minh; bạn đăng nhập được ngay để hoàn thiện hồ sơ."
    />
  );
}

export function FinanceOverview() {
  return (
    <ProviderOverview
      portal="finance"
      loginHref={loginHref}
      kicker="Đối tác tài chính"
      gradient="from-brand-orange to-brand-orange-2"
      statLabels={["Sản phẩm chờ duyệt", "Yêu cầu mới", "Tổng sản phẩm", "Tổng yêu cầu"]}
      statClass="text-brand-orange"
      unverifiedMessage="Sản phẩm chỉ lưu được ở trạng thái Nháp và chưa mở được liên hệ. Admin cần đối chiếu giấy phép trước khi xác minh."
      tilesTitle="Quản lý đơn vị"
      load={() =>
        loadProviderOverview({
          getProfile,
          listItems: (params) => listProducts(asParams(params)),
          listInquiries: (params) => listInquiries(asParams(params)),
          itemNoun: "Sản phẩm",
          itemLabel: PRODUCT_STATUS_LABEL,
          itemTone: PRODUCT_STATUS_TONE,
          itemHref: ROUTES.taiChinhDoiTacProducts,
          inquiryType: "Yêu cầu tư vấn",
          inquiryLabel: CONSULT_INQUIRY_LABEL,
          inquiryTone: CONSULT_INQUIRY_TONE,
          inquiryHref: ROUTES.taiChinhDoiTacInquiries,
          inquirySubject: subject,
          subtitle: (profile) => {
            const limit = typeof profile.contact_view_limit === "number" ? profile.contact_view_limit : 0;
            return `Hạn mức mở liên hệ: ${limit.toLocaleString("vi-VN")} lượt/tháng${profile.email ? ` · ${profile.email}` : ""}`;
          },
        })
      }
    />
  );
}

export function FinanceProducts({ verified }: { verified: boolean }) {
  return (
    <ProviderProducts
      verified={verified}
      config={{
        loginHref,
        accent,
        title: "💰 Sản phẩm của tôi",
        description: "Tạo và theo dõi sản phẩm tài chính. Sản phẩm đã gửi cần Admin duyệt mới hiển thị công khai.",
        searchPlaceholder: "Tìm theo tên sản phẩm…",
        unit: "sản phẩm",
        fields: FINANCE_PRODUCT_FIELDS,
        emptyValues: FINANCE_PRODUCT_EMPTY,
        toValues: financeProductToValues,
        validate: financeProductError,
        buildBody: financeProductBody,
        list: (params) => listProducts(asParams(params)),
        create: createProduct,
        update: updateProduct,
        // Máy chủ đòi đúng mốc `updated_at` của bản ghi để không ẩn nhầm bản vừa được sửa ở thiết bị khác.
        archive: (row) => {
          const expected = text(row.updated_at);
          if (!expected) {
            return Promise.reject(new MobileApiError("Thiếu mốc phiên bản của sản phẩm. Tải lại danh sách rồi thử lại.", 0, "RESPONSE"));
          }
          return archiveProduct(row.id, expected);
        },
        meta: financeProductMeta,
        editApprovedWarning:
          "Đây là sản phẩm đang công khai: lưu thay đổi sẽ đưa sản phẩm về “Chờ Admin duyệt” và tạm ngừng hiển thị cho tới khi được duyệt lại.",
      }}
    />
  );
}

export function FinanceInquiries() {
  return (
    <ProviderInquiries
      loginHref={loginHref}
      accent={accent}
      title="📨 Yêu cầu tư vấn"
      description="Công nhân quan tâm sản phẩm của bạn. Số điện thoại chỉ mở khi người gửi đã đồng ý và trừ vào hạn mức tháng."
      searchPlaceholder="Tìm theo tên người gửi…"
      labels={CONSULT_INQUIRY_LABEL}
      tones={CONSULT_INQUIRY_TONE}
      filters={inquiryFilters(CONSULT_INQUIRY_STATUSES, CONSULT_INQUIRY_LABEL)}
      transitions={CONSULT_INQUIRY_TRANSITIONS}
      listInquiries={(params) => listInquiries(asParams(params))}
      updateInquiryStatus={updateInquiryStatus}
      openInquiryContact={openInquiryContact}
      subject={subject}
      details={(row) => {
        const code = text(row.destination_province_code);
        return code ? [`Chuyển tiền về: ${provinceName(code) || code}`] : [];
      }}
    />
  );
}

export function FinanceOrders() {
  return (
    <ProviderOrders
      api={financeApi.orders}
      loginHref={loginHref}
      accent={accent}
      title="💳 Gói & hạn mức"
      description="Chọn gói Basic hoặc Premium để có thêm lượt mở liên hệ tư vấn mỗi tháng."
      limitKey="inquiryContactLimit"
      limitText="lượt mở liên hệ tư vấn mỗi tháng"
    />
  );
}

/** Tải hồ sơ giấy phép lên kho riêng. Máy chủ có thể làm MẤT xác minh vì giấy phép đã đổi, nên nói rõ cho người dùng. */
function LicenseEvidenceUpload({ profile, reload, setNotice, setError, markUncertain, disabled }: ProfileExtraContext) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = isPrivateEvidence(text(profile.license_evidence_url));

  async function pick(file: File | undefined) {
    if (!file || busy) return;
    if (file.size > EVIDENCE_MAX_BYTES) {
      setError("Hồ sơ giấy phép phải nhỏ hơn 10MB.");
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await uploadLicenseEvidence(file);
      await reload();
      setNotice(
        profile.is_verified && !result.isVerified
          ? "Đã tải hồ sơ giấy phép. Vì giấy phép thay đổi, Admin cần xác minh lại; trong thời gian đó sản phẩm chỉ lưu được ở trạng thái Nháp."
          : "Đã tải hồ sơ giấy phép lên.",
      );
    } catch (err) {
      if (err instanceof MobileApiError && err.uncertain) markUncertain(messageOf(err, "Chưa xác nhận được hồ sơ giấy phép đã lưu."));
      else setError(messageOf(err, "Chưa tải được hồ sơ giấy phép."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-black/5 bg-[#f6f7f9] p-3.5">
      <div className="text-[12.5px] font-bold text-brand-navy">Hồ sơ giấy phép</div>
      <p className="mt-1 text-[12px] leading-relaxed text-brand-navy/55">
        {uploaded
          ? "Đã có hồ sơ lưu trong kho riêng (chỉ Admin xem được). Tải tệp mới để thay thế."
          : "Tải bản scan giấy phép (PDF, JPG, PNG hoặc WEBP, tối đa 10MB), hoặc nhập liên kết hồ sơ ở ô phía trên."}
      </p>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        disabled={busy || disabled}
        onChange={(event) => pick(event.target.files?.[0])}
        className="mt-2 block w-full text-[12px] text-brand-navy/60 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-orange-light file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-brand-orange"
      />
      {busy && <p className="mt-1.5 text-[11.5px] text-brand-navy/45">Đang tải hồ sơ lên…</p>}
    </div>
  );
}

export function FinanceProfile() {
  return (
    <ProviderProfile
      loginHref={loginHref}
      accent={accent}
      title="🏢 Hồ sơ đơn vị"
      description="Thông tin pháp lý, giấy phép, liên hệ và logo hiển thị cùng sản phẩm."
      fields={financeProfileFields}
      getProfile={getProfile}
      saveProfile={saveProfile}
      toValues={financeProfileToValues}
      validate={financeProfileError}
      buildBody={financeProfileBody}
      matches={financeProfileMatches}
      uploadLogo={uploadLogo}
      logoAccept="image/jpeg,image/png,image/webp"
      logoHint="JPG, PNG hoặc WEBP, tối đa 5MB."
      logoAlt="Logo đơn vị tài chính"
      fileButtonClass="file:bg-brand-orange-light file:text-brand-orange"
      sideRows={(profile) => [
        { label: "Email", value: profile.email || "—" },
        {
          label: "Hạn mức liên hệ",
          value: `${(typeof profile.contact_view_limit === "number" ? profile.contact_view_limit : 0).toLocaleString("vi-VN")}/tháng`,
        },
      ]}
      renderExtra={(ctx) => <LicenseEvidenceUpload {...ctx} />}
      verificationLostMessage="Đã cập nhật hồ sơ. Vì thông tin pháp lý thay đổi, Admin cần xác minh lại; trong thời gian đó sản phẩm chỉ lưu được ở trạng thái Nháp và chưa mở được liên hệ."
    />
  );
}

export function FinanceBooked() {
  return <ProviderBooked listBooked={listBooked} loginHref={loginHref} />;
}
