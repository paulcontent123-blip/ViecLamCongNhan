"use client";

// Các màn của cổng Đơn vị bảo hiểm: ghép cấu hình riêng của cổng vào các component dùng chung.

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { ProviderLoginForm, ProviderRegisterForm } from "@/components/doitac/ProviderAuthForms";
import { ProviderBooked } from "@/components/doitac/ProviderBooked";
import { ProviderInquiries } from "@/components/doitac/ProviderInquiries";
import { ProviderOrders } from "@/components/doitac/ProviderOrders";
import { ProviderOverview } from "@/components/doitac/ProviderOverview";
import { ProviderProducts } from "@/components/doitac/ProviderProducts";
import { ProviderProfile } from "@/components/doitac/ProviderProfile";
import { loadProviderOverview } from "@/components/doitac/providerOverviewLoader";
import {
  createProduct,
  getProfile,
  insuranceApi,
  listBooked,
  listInquiries,
  listProducts,
  login,
  openInquiryContact,
  register,
  saveProfile,
  updateInquiryStatus,
  updateProduct,
  uploadLogo,
} from "@/lib/insurance-provider-client";
import {
  INSURANCE_PRODUCT_EMPTY,
  INSURANCE_PRODUCT_FIELDS,
  INSURANCE_PROFILE_FIELDS,
  INSURANCE_REGISTER_FIELDS,
  INSURANCE_REGISTER_INITIAL,
  insuranceProductBody,
  insuranceProductError,
  insuranceProductMeta,
  insuranceProductToValues,
  insuranceProfileBody,
  insuranceProfileError,
  insuranceProfileMatches,
  insuranceProfileToValues,
  insuranceRegisterBody,
  insuranceRegisterError,
} from "@/lib/insurance-provider-portal";
import type { MobileQuery } from "@/lib/mobile-session-client";
import {
  CONSULT_INQUIRY_LABEL,
  CONSULT_INQUIRY_STATUSES,
  CONSULT_INQUIRY_TONE,
  CONSULT_INQUIRY_TRANSITIONS,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  inquiryFilters,
} from "@/lib/provider-portal-common";
import { ROUTES } from "@/lib/routes";

const accent = PORTAL_ACCENT;
const loginHref = ROUTES.baoHiemDoiTacLogin;
const text = (value: unknown) => (typeof value === "string" ? value : "");

type ListParams = { status?: string; q?: string; page?: number; pageSize?: number };
const asParams = (params: MobileQuery) => params as ListParams;
const subject = (row: Record<string, unknown>) => text((row.insurance_products as { title?: unknown } | null)?.title);

export function InsuranceLoginForm() {
  return (
    <ProviderLoginForm
      icon="🛡️"
      title="Đăng nhập đối tác bảo hiểm"
      accent={accent}
      login={login}
      dashboardHref={ROUTES.baoHiemDoiTacDashboard}
      registerHref={ROUTES.baoHiemDoiTac}
      registerLabel="Chưa có tài khoản? Đăng ký đối tác"
    />
  );
}

export function InsuranceRegisterForm() {
  return (
    <ProviderRegisterForm
      title="Đăng ký đối tác bảo hiểm"
      intro="Tạo tài khoản cho doanh nghiệp bảo hiểm, đại lý được ủy quyền hoặc chương trình công."
      accent={accent}
      fields={INSURANCE_REGISTER_FIELDS}
      initialValues={INSURANCE_REGISTER_INITIAL}
      validate={insuranceRegisterError}
      buildBody={insuranceRegisterBody}
      register={register}
      loginHref={loginHref}
      successTitle="Đã gửi đăng ký"
      successNote="Tài khoản đã được tạo. Admin sẽ đối chiếu số giấy phép trước khi xác minh; bạn đăng nhập được ngay để hoàn thiện hồ sơ."
    />
  );
}

export function InsuranceOverview() {
  return (
    <ProviderOverview
      portal="insurance"
      loginHref={loginHref}
      kicker="Đối tác bảo hiểm"
      gradient="from-brand-orange to-brand-orange-2"
      statLabels={["Sản phẩm chờ duyệt", "Yêu cầu mới", "Tổng sản phẩm", "Tổng yêu cầu"]}
      statClass="text-brand-orange"
      unverifiedMessage="Sản phẩm chỉ lưu được ở trạng thái Nháp và chưa mở được liên hệ. Admin cần đối chiếu số giấy phép trước khi xác minh."
      tilesTitle="Quản lý đơn vị"
      load={() =>
        loadProviderOverview({
          getProfile,
          listItems: (params) => listProducts(asParams(params)),
          listInquiries: (params) => listInquiries(asParams(params)),
          itemNoun: "Sản phẩm",
          itemLabel: PRODUCT_STATUS_LABEL,
          itemTone: PRODUCT_STATUS_TONE,
          itemHref: ROUTES.baoHiemDoiTacProducts,
          inquiryType: "Yêu cầu tư vấn",
          inquiryLabel: CONSULT_INQUIRY_LABEL,
          inquiryTone: CONSULT_INQUIRY_TONE,
          inquiryHref: ROUTES.baoHiemDoiTacInquiries,
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

export function InsuranceProducts({ verified }: { verified: boolean }) {
  return (
    <ProviderProducts
      verified={verified}
      config={{
        loginHref,
        accent,
        title: "🛡️ Sản phẩm của tôi",
        description: "Tạo và theo dõi sản phẩm bảo hiểm. Sản phẩm đã gửi cần Admin duyệt mới hiển thị công khai.",
        searchPlaceholder: "Tìm theo tên sản phẩm…",
        unit: "sản phẩm",
        fields: INSURANCE_PRODUCT_FIELDS,
        emptyValues: INSURANCE_PRODUCT_EMPTY,
        toValues: insuranceProductToValues,
        validate: insuranceProductError,
        buildBody: insuranceProductBody,
        list: (params) => listProducts(asParams(params)),
        create: createProduct,
        update: updateProduct,
        meta: insuranceProductMeta,
        editApprovedWarning:
          "Đây là sản phẩm đang công khai: lưu thay đổi sẽ đưa sản phẩm về “Chờ Admin duyệt” và tạm ngừng hiển thị cho tới khi được duyệt lại.",
      }}
    />
  );
}

export function InsuranceInquiries() {
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
    />
  );
}

export function InsuranceOrders() {
  return (
    <ProviderOrders
      api={insuranceApi.orders}
      loginHref={loginHref}
      accent={accent}
      title="💳 Gói & hạn mức"
      description="Chọn gói Basic hoặc Premium để có thêm lượt mở liên hệ tư vấn mỗi tháng."
      limitKey="inquiryContactLimit"
      limitText="lượt mở liên hệ tư vấn mỗi tháng"
    />
  );
}

export function InsuranceProfile() {
  return (
    <ProviderProfile
      loginHref={loginHref}
      accent={accent}
      title="🏢 Hồ sơ đơn vị"
      description="Thông tin pháp lý, liên hệ và logo hiển thị cùng sản phẩm."
      fields={INSURANCE_PROFILE_FIELDS}
      getProfile={getProfile}
      saveProfile={saveProfile}
      toValues={insuranceProfileToValues}
      validate={insuranceProfileError}
      buildBody={insuranceProfileBody}
      matches={insuranceProfileMatches}
      uploadLogo={uploadLogo}
      logoAccept="image/jpeg,image/png,image/webp"
      logoHint="JPG, PNG hoặc WEBP, tối đa 5MB."
      logoAlt="Logo đơn vị bảo hiểm"
      fileButtonClass="file:bg-brand-orange-light file:text-brand-orange"
      sideRows={(profile) => [
        { label: "Email", value: profile.email || "—" },
        {
          label: "Hạn mức liên hệ",
          value: `${(typeof profile.contact_view_limit === "number" ? profile.contact_view_limit : 0).toLocaleString("vi-VN")}/tháng`,
        },
      ]}
      verificationLostMessage="Đã cập nhật hồ sơ. Vì thông tin pháp lý thay đổi, Admin cần xác minh lại; trong thời gian đó sản phẩm chỉ lưu được ở trạng thái Nháp và chưa mở được liên hệ."
    />
  );
}

export function InsuranceBooked() {
  return <ProviderBooked listBooked={listBooked} loginHref={loginHref} />;
}
