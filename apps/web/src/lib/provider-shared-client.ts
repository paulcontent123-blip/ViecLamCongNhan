// Phần gọi API giống hệt nhau giữa các cổng đối tác: đăng nhập, đăng xuất, logo, gói & đơn hàng, dịch vụ đã đặt.
//
// Mỗi cổng (Bảo hiểm, Tài chính, Thuê trọ…) chỉ khác nhau ở đoạn đường dẫn (`insurance-provider`…) và tên phiên
// trong thông báo lỗi, nên dùng một nhà máy thay vì chép ba lần. Hình dạng phản hồi đã đối chiếu từng route:
// `orders`, `payment-methods`, `orders/[code]`, `service-inquiries` và `logo` của các loại đối tác khớp nhau.
//
// KHÔNG thêm hay sửa route nào ở máy chủ. Quy tắc ghi là bản sao của app: kết quả không rõ thì KHÔNG tự gửi lại.

import { createMobileClient, MobileApiError, type MobileListResult } from "@/lib/mobile-session-client";

const UNCERTAIN = "Chưa xác định thao tác đã được lưu hay chưa. Tải lại trang để kiểm tra trước khi làm lại.";

export type ProviderApiConfig = {
  /** Đoạn đường dẫn của cổng, ví dụ "insurance-provider" (dùng cho `api/mobile/<slug>/*` và `api/auth/<slug>/*`). */
  slug: string;
  /** Tên phiên trong câu báo hết hạn, ví dụ "đơn vị bảo hiểm". */
  sessionLabel: string;
  /** Đường dẫn route đăng ký, ví dụ "insurance-providers". */
  registerPath: string;
  /** Tên gọi tài khoản khi báo lỗi, ví dụ "đơn vị bảo hiểm". */
  noun: string;
};

export function createProviderApi(config: ProviderApiConfig) {
  const { slug, sessionLabel, registerPath, noun } = config;
  /** Đăng ký và đăng nhập nằm ngoài `api/mobile`. */
  const auth = createMobileClient({ sessionLabel, uncertainMessage: UNCERTAIN, prefix: "api" });
  /** Toàn bộ dữ liệu của cổng nằm dưới `api/mobile/<slug>/`. */
  const portal = createMobileClient({ sessionLabel, uncertainMessage: UNCERTAIN });
  const P = slug;

  // ───────── Phiên ─────────

  async function register(body: Record<string, unknown>) {
    const data = await auth.post<{ provider?: { id?: unknown } }>(registerPath, body, {
      // Đăng ký hai lần tạo hai tài khoản nên tuyệt đối không gửi lại; chỉ dẫn người dùng đi thử đăng nhập.
      uncertainMessage:
        "Chưa xác định tài khoản đã được tạo hay chưa. Hãy thử đăng nhập bằng email vừa đăng ký trước khi gửi lại.",
    });
    const id = data.provider?.id;
    if (typeof id !== "string" || !id) {
      throw new MobileApiError(
        "Chưa xác nhận được tài khoản đã tạo. Hãy thử đăng nhập bằng email vừa đăng ký trước khi gửi lại.",
        0,
        "UNCERTAIN",
      );
    }
    return id;
  }

  async function login(identifier: string, password: string) {
    const data = await auth.post<{ provider?: { id?: unknown } }>(
      `auth/${slug}/login`,
      { identifier, password },
      // Đăng nhập lặp lại không gây hại; sai thông tin thì cứ báo lỗi để người dùng nhập lại.
      { uncertainMessage: "Chưa xác định đã đăng nhập hay chưa. Tải lại trang để kiểm tra." },
    );
    if (typeof data.provider?.id !== "string") {
      throw new MobileApiError(`Chưa đăng nhập được ${noun}.`, 0, "RESPONSE");
    }
  }

  async function logout() {
    await auth.post(`auth/${slug}/logout`, {}, { uncertainMessage: "Chưa xác định đã đăng xuất hay chưa." });
  }

  // ───────── Logo ─────────

  /** Tải logo: dùng fetch thẳng vì đây là multipart, không phải JSON. */
  async function uploadLogo(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const uncertain = "Chưa xác nhận được logo đã lưu. Tải lại hồ sơ trước khi thử lại.";
    let response: Response;
    try {
      response = await fetch(`/api/mobile/${P}/logo`, { method: "POST", body: form });
    } catch {
      throw new MobileApiError(uncertain, 0, "UNCERTAIN");
    }
    const data = (await response.json().catch(() => null)) as { ok?: unknown; url?: unknown; error?: unknown } | null;
    if (!response.ok) {
      if (response.status >= 500) throw new MobileApiError(uncertain, response.status, "UNCERTAIN");
      throw new MobileApiError(
        typeof data?.error === "string" ? data.error : "Chưa tải được logo.",
        response.status,
        "HTTP",
      );
    }
    if (data?.ok !== true || typeof data.url !== "string" || !data.url.startsWith("https://")) {
      throw new MobileApiError(uncertain, 0, "UNCERTAIN");
    }
    return data.url;
  }

  // ───────── Gói và đơn hàng ─────────

  const listOrders = (params: { page?: number; pageSize?: number }) =>
    portal.list<Record<string, unknown>>(`${P}/orders`, { ...params });

  async function getPaymentMethods() {
    const data = await portal.get<{ bank_transfer?: unknown; momo?: unknown }>(`${P}/payment-methods`);
    if (typeof data.bank_transfer !== "boolean" || typeof data.momo !== "boolean") {
      throw new MobileApiError("Phản hồi phương thức thanh toán không hợp lệ.", 0, "RESPONSE");
    }
    return { bank_transfer: data.bank_transfer, momo: data.momo };
  }

  async function createOrder(tier: string, paymentMethod: string) {
    const data = await portal.post<{ payment?: { code?: unknown } }>(
      `${P}/orders`,
      { tier, paymentMethod },
      { uncertainMessage: "Chưa xác định đơn đã tạo hay chưa. Tải lại lịch sử đơn trước khi thử lại." },
    );
    const code = data.payment?.code;
    if (typeof code !== "string" || !code) {
      throw new MobileApiError("Chưa xác nhận được đơn đã tạo. Tải lại lịch sử đơn trước khi thử lại.", 0, "UNCERTAIN");
    }
    return code;
  }

  /** Chi tiết thanh toán của một đơn (thông tin chuyển khoản hoặc ví MoMo). */
  async function getOrderPayment(code: string) {
    const data = await portal.get<{ payment?: unknown }>(`${P}/orders/${encodeURIComponent(code.toUpperCase())}`);
    const payment = data.payment as { code?: unknown } | null;
    if (!payment || typeof payment !== "object" || payment.code !== code.toUpperCase()) {
      throw new MobileApiError("Phản hồi chi tiết thanh toán không hợp lệ.", 0, "RESPONSE");
    }
    return payment as Record<string, unknown>;
  }

  /**
   * Báo "tôi đã chuyển tiền" để Admin đối soát. Phản hồi không rõ thì ĐỌC LẠI đơn và đối chiếu cờ `confirmed`,
   * như app làm; không gửi PATCH lần hai.
   */
  async function setOrderConfirmed(code: string, confirmed: boolean) {
    let uncertain: Error | null = null;
    try {
      const data = await portal.patch<{ payment?: { confirmed?: unknown } }>(
        `${P}/orders/${encodeURIComponent(code.toUpperCase())}`,
        { confirmed },
        { uncertainMessage: "Chưa xác định được thông báo thanh toán đã lưu hay chưa. Tải lại trạng thái đơn." },
      );
      if (data.payment?.confirmed === confirmed) return;
      uncertain = new MobileApiError("Phản hồi thông báo thanh toán không hợp lệ.", 0, "UNCERTAIN");
    } catch (error) {
      if (error instanceof MobileApiError && error.status > 0 && error.status < 500) throw error;
      uncertain = error instanceof Error ? error : new Error(UNCERTAIN);
    }
    try {
      const latest = await getOrderPayment(code);
      if (latest.confirmed === confirmed) return;
    } catch {
      // Đọc lại hỏng: vẫn chưa xác định, không gửi lại.
    }
    throw uncertain;
  }

  // ───────── Dịch vụ đã đặt (chỉ xem) ─────────

  /**
   * Route này KHÔNG phân trang (trả tối đa 100 dòng, không có `page`/`pageSize`) nên không dùng `list`,
   * vốn đòi phản hồi khớp trang đã yêu cầu.
   */
  async function listBooked(): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const data = await portal.get<{ items?: unknown; total?: unknown }>(`${P}/service-inquiries`);
    if (!Array.isArray(data.items)) throw new MobileApiError("Phản hồi dịch vụ đã đặt không hợp lệ.", 0, "RESPONSE");
    const items = data.items as Record<string, unknown>[];
    return { items, total: Number.isSafeInteger(data.total) ? (data.total as number) : items.length };
  }

  // ───────── Hồ sơ ─────────

  type Profile = Record<string, unknown> & { id: string; provider_name: string; is_verified: boolean };

  async function getProfile(): Promise<Profile & { email: string }> {
    const data = await portal.get<{ provider?: unknown; email?: unknown }>(`${P}/profile`);
    if (!data.provider || typeof data.provider !== "object") {
      throw new MobileApiError("Phản hồi hồ sơ không hợp lệ.", 0, "RESPONSE");
    }
    return { ...(data.provider as Profile), email: typeof data.email === "string" ? data.email : "" };
  }

  /**
   * Lưu hồ sơ rồi ĐỌC LẠI để xác nhận.
   *
   * PATCH hồ sơ không trả lại hồ sơ đầy đủ nên không đọc lại thì không biết đã lưu đúng chưa. Đọc lại hỏng hoặc
   * không khớp thì giữ "chưa xác định" và KHÔNG gửi PATCH lần nữa. `matches` do từng cổng cung cấp vì mỗi loại đối
   * tác có bộ trường khác nhau.
   */
  async function saveProfile(
    body: Record<string, unknown>,
    matches: (latest: Profile) => boolean,
  ): Promise<Profile & { email: string }> {
    let uncertain: Error | null = null;
    try {
      await portal.patch(`${P}/profile`, body, {
        uncertainMessage: "Chưa xác định được hồ sơ đã lưu hay chưa. Tải lại hồ sơ trước khi thao tác lại.",
      });
    } catch (error) {
      // Lỗi dữ liệu (4xx) thì nói thẳng cho người dùng sửa; còn lại là chưa xác định, phải đọc lại mới biết.
      if (error instanceof MobileApiError && error.status > 0 && error.status < 500) throw error;
      uncertain = error instanceof Error ? error : new Error(UNCERTAIN);
    }
    try {
      const latest = await getProfile();
      if (matches(latest)) return latest;
    } catch {
      // Đọc lại hỏng: vẫn là chưa xác định, không gửi lại PATCH.
    }
    throw (
      uncertain ??
      new MobileApiError(
        "Máy chủ phản hồi nhưng hồ sơ chưa khớp. Tải lại để kiểm tra trước khi thao tác tiếp.",
        0,
        "UNCERTAIN",
      )
    );
  }

  // ───────── Danh sách và mục (sản phẩm, tin cho thuê…) ─────────

  const listResource = <T>(resource: string, params: Record<string, string | number | undefined>) =>
    portal.list<T>(`${P}/${resource}`, { ...params });

  /**
   * Tạo mới một mục. `key` là tên trường chứa bản ghi trong phản hồi (`product`, `listing`).
   * Trả về `{ id, status }`; thiếu mã thì coi là chưa xác định, vì mục có thể đã được tạo.
   */
  async function createItem(
    resource: string,
    key: string,
    body: Record<string, unknown>,
    uncertainMessage: string,
  ): Promise<{ id: string; status: string }> {
    const data = await portal.post<Record<string, { id?: unknown; status?: unknown } | undefined>>(
      `${P}/${resource}`,
      body,
      { uncertainMessage },
    );
    const item = data[key];
    if (typeof item?.id !== "string") {
      throw new MobileApiError("Chưa xác nhận được bản ghi đã lưu. Tải lại danh sách trước khi thử lại.", 0, "UNCERTAIN");
    }
    return { id: item.id, status: typeof item.status === "string" ? item.status : "" };
  }

  async function updateItem(
    resource: string,
    key: string,
    id: string,
    body: Record<string, unknown>,
    uncertainMessage: string,
  ): Promise<{ id: string; status: string }> {
    const data = await portal.patch<Record<string, { id?: unknown; status?: unknown } | undefined>>(
      `${P}/${resource}/${encodeURIComponent(id)}`,
      body,
      { uncertainMessage },
    );
    const item = data[key];
    if (item?.id !== id) {
      throw new MobileApiError("Chưa xác nhận được cập nhật. Tải lại danh sách trước khi thao tác lại.", 0, "UNCERTAIN");
    }
    return { id, status: typeof item.status === "string" ? item.status : "" };
  }

  // ───────── Yêu cầu và mở liên hệ ─────────

  type InquiryRow = Record<string, unknown> & { id: string; full_name: string; status: string };

  const listInquiries = (params: { status?: string; q?: string; page?: number; pageSize?: number; id?: string }) =>
    portal.list<InquiryRow>(`${P}/inquiries`, { ...params });

  /** Đọc lại đúng một yêu cầu qua route danh sách (`?id=`). Các route Bảo hiểm, Tài chính, Thuê trọ đều hỗ trợ. */
  async function readInquiry(id: string): Promise<InquiryRow | null> {
    try {
      const result = await listInquiries({ id, page: 1, pageSize: 1 });
      const item = result.items[0];
      return result.total === 1 && item?.id === id ? item : null;
    } catch {
      return null;
    }
  }

  /**
   * Đổi trạng thái rồi xác nhận. Phản hồi không khớp thì ĐỌC LẠI đúng yêu cầu đó và đối chiếu, như app làm;
   * không gửi PATCH lần hai.
   */
  async function updateInquiryStatus(id: string, status: string) {
    let uncertain: Error | null = null;
    try {
      const data = await portal.patch<{ inquiry?: { id?: unknown; status?: unknown } }>(
        `${P}/inquiries/${encodeURIComponent(id)}`,
        { status },
        { uncertainMessage: "Chưa xác định được trạng thái đã lưu hay chưa. Tải lại danh sách để kiểm tra." },
      );
      if (data.inquiry?.id === id && data.inquiry.status === status) return;
      uncertain = new MobileApiError("Phản hồi cập nhật trạng thái không hợp lệ.", 0, "UNCERTAIN");
    } catch (error) {
      if (error instanceof MobileApiError && error.status > 0 && error.status < 500) throw error;
      uncertain = error instanceof Error ? error : new Error(UNCERTAIN);
    }
    const confirmed = await readInquiry(id);
    if (confirmed?.status === status) return;
    throw uncertain;
  }

  type Contact = { phone: string; email: string | null; zalo: string | null; viewedCount: number; viewLimit: number };

  /**
   * Mở liên hệ là thao tác ghi: trừ vào hạn mức tháng, mở lại cùng yêu cầu trong tháng thì không trừ thêm.
   * Thuê trọ trả số lượt trong khối `usage`, các loại khác trả thẳng `viewedCount`/`viewLimit`; gom về một dạng.
   */
  async function openContact(path: string): Promise<Contact> {
    const data = await portal.post<Record<string, unknown>>(
      `${P}/${path}`,
      {},
      { uncertainMessage: "Chưa xác định lượt mở liên hệ đã ghi nhận chưa. Tải lại danh sách trước khi thử tiếp." },
    );
    const usage = (data.usage && typeof data.usage === "object" ? data.usage : data) as Record<string, unknown>;
    if (
      typeof data.phone !== "string" ||
      !data.phone.trim() ||
      !Number.isSafeInteger(usage.viewedCount) ||
      !Number.isSafeInteger(usage.viewLimit)
    ) {
      throw new MobileApiError("Phản hồi quyền liên hệ không hợp lệ.", 0, "RESPONSE");
    }
    const optional = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
    return {
      phone: data.phone,
      email: optional(data.email),
      zalo: optional(data.zalo),
      viewedCount: usage.viewedCount as number,
      viewLimit: usage.viewLimit as number,
    };
  }

  const openInquiryContact = (id: string) => openContact(`inquiries/${encodeURIComponent(id)}/contact`);

  return {
    auth,
    portal,
    P,
    register,
    login,
    logout,
    uploadLogo,
    orders: { listOrders, getPaymentMethods, createOrder, getOrderPayment, setOrderConfirmed },
    listBooked,
    getProfile,
    saveProfile,
    listResource,
    createItem,
    updateItem,
    listInquiries,
    updateInquiryStatus,
    openContact,
    openInquiryContact,
  };
}

export type ProviderApi = ReturnType<typeof createProviderApi>;
export type ProviderOrdersApi = ProviderApi["orders"];
export type { MobileListResult };
