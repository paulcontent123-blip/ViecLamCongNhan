"use client";

// Trang đăng ký chia hai ngăn:
//  - Người lao động: đăng ký bằng số điện thoại, chờ Admin xác nhận.
//  - Nhà tuyển dụng - đối tác: MỘT menu chọn loại tài khoản (Nhà tuyển dụng hoặc một trong 5 loại đối tác dịch vụ) rồi nhập
//    cùng một bộ thông tin như đăng ký Nhà tuyển dụng. Mỗi loại gọi đúng route đăng ký có sẵn của nó, không đổi BE.
//    Nhà tuyển dụng giữ nguyên như trước (`POST /api/employers`, xong thì vào trang quản lý).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CandidateRegisterForm } from "@/components/congnhan/CandidateAuthForms";
import { register as registerFinance } from "@/lib/finance-provider-client";
import { register as registerHealth } from "@/lib/health-provider-client";
import { register as registerInsurance } from "@/lib/insurance-provider-client";
import { MobileApiError } from "@/lib/mobile-session-client";
import { register as registerRental } from "@/lib/rental-provider-client";
import { ROUTES } from "@/lib/routes";
import { register as registerTraining } from "@/lib/training-provider-client";

type Tab = "lao-dong" | "doi-tac";
type AccountType = "employer" | "training" | "health" | "insurance" | "finance" | "rental";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange";

type TypeConfig = {
  label: string;
  /** Nhãn ô tên đơn vị. */
  nameLabel: string;
  namePlaceholder: string;
  /** Hàm đăng ký có sẵn của loại đối tác; Nhà tuyển dụng dùng `/api/employers` riêng. */
  register?: (body: Record<string, unknown>) => Promise<string>;
  /** Một số loại bắt buộc thêm thông tin pháp lý theo máy chủ. */
  needsLicense?: boolean;
  note: string;
};

const TYPES: Record<AccountType, TypeConfig> = {
  employer: {
    label: "🏢 Nhà tuyển dụng",
    nameLabel: "Tên đơn vị / Công ty",
    namePlaceholder: "VD: Công ty TNHH ABC",
    note: "",
  },
  training: {
    label: "🎓 Đối tác học nghề (đơn vị đào tạo)",
    nameLabel: "Tên đơn vị đào tạo",
    namePlaceholder: "VD: Trung tâm dạy nghề ABC",
    register: registerTraining,
    note: "Admin sẽ đối chiếu thông tin trước khi xác minh đơn vị.",
  },
  health: {
    label: "🏥 Đối tác y tế (cơ sở y tế)",
    nameLabel: "Tên cơ sở y tế",
    namePlaceholder: "VD: Phòng khám ABC",
    register: registerHealth,
    note: "Admin sẽ đối chiếu giấy phép trước khi xác minh cơ sở. Bạn bổ sung giấy phép ở mục Hồ sơ sau khi đăng nhập.",
  },
  insurance: {
    label: "🛡️ Đối tác bảo hiểm",
    nameLabel: "Tên đơn vị bảo hiểm",
    namePlaceholder: "VD: Công ty bảo hiểm ABC",
    register: registerInsurance,
    note: "Admin sẽ đối chiếu giấy phép trước khi xác minh đơn vị. Bạn bổ sung giấy phép ở mục Hồ sơ sau khi đăng nhập.",
  },
  finance: {
    label: "💰 Đối tác tài chính",
    nameLabel: "Tên đơn vị tài chính",
    namePlaceholder: "VD: Công ty tài chính ABC",
    register: registerFinance,
    needsLicense: true,
    note: "Đơn vị tài chính cần có số giấy phép / ủy quyền. Admin sẽ đối chiếu trước khi xác minh.",
  },
  rental: {
    label: "🏠 Đối tác thuê trọ (chủ trọ)",
    nameLabel: "Tên chủ trọ / đơn vị cho thuê",
    namePlaceholder: "VD: Nhà trọ ABC",
    register: registerRental,
    note: "Admin sẽ xác minh trước khi bạn gửi tin cho thuê duyệt.",
  },
};

const TYPE_ORDER: AccountType[] = ["employer", "training", "health", "insurance", "finance", "rental"];

export function RegisterTabs({ initialTab = "lao-dong" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="w-full max-w-[520px] rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-5 text-center">
        <div className="text-[34px]" aria-hidden="true">
          📝
        </div>
        <h1 className="mt-1 text-[19px] font-extrabold text-brand-navy">Đăng ký tài khoản</h1>
        <p className="mt-1 text-[12.5px] text-brand-navy/50">
          Đã có tài khoản?{" "}
          <Link href={ROUTES.congNhanLogin} className="font-bold text-brand-orange">
            Đăng nhập
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#f6f7f9] p-1">
        {(
          [
            { value: "lao-dong", label: "👷 Người lao động" },
            { value: "doi-tac", label: "🏢 Nhà tuyển dụng - đối tác" },
          ] as const
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            aria-pressed={tab === item.value}
            className={`rounded-lg px-2 py-2 text-[12.5px] font-bold transition ${
              tab === item.value ? "bg-white text-brand-orange shadow-sm" : "text-brand-navy/50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5">{tab === "lao-dong" ? <CandidateRegisterForm /> : <BusinessRegisterForm />}</div>
    </div>
  );
}

/** Đăng ký Nhà tuyển dụng hoặc một loại đối tác dịch vụ: chọn loại ở menu, nhập cùng bộ thông tin. */
function BusinessRegisterForm() {
  const router = useRouter();
  const [type, setType] = useState<AccountType>("employer");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [license, setLicense] = useState("");
  const [error, setError] = useState("");
  /** Đăng ký đối tác chưa rõ kết quả: khoá nút, vì gửi lại có thể tạo tài khoản trùng. */
  const [uncertain, setUncertain] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const config = TYPES[type];
  const isPartner = type !== "employer";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");

    if (!isPartner) {
      setBusy(true);
      try {
        // Giữ nguyên cách đăng ký Nhà tuyển dụng như trước đây.
        const response = await fetch("/api/employers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: name, contactPhone: phone, email, password }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setError(data?.error ?? "Có lỗi xảy ra, thử lại sau.");
          setBusy(false);
          return;
        }
        router.push(ROUTES.ntdDashboard);
        router.refresh();
      } catch {
        setError("Không kết nối được máy chủ, thử lại sau.");
        setBusy(false);
      }
      return;
    }

    // Kiểm tra sớm giống các form đăng ký của từng cổng; máy chủ vẫn là nơi quyết định.
    if (name.trim().length < 2) return setError("Nhập tên đơn vị (tối thiểu 2 ký tự).");
    if (contactName.trim().length < 2) return setError("Nhập tên người phụ trách (tối thiểu 2 ký tự).");
    if (phone.replace(/\D/g, "").length < 9) return setError("Số điện thoại liên hệ không hợp lệ.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Email đăng nhập chưa đúng định dạng.");
    if (password.length < 8) return setError("Mật khẩu tối thiểu 8 ký tự.");
    if (config.needsLicense && !license.trim()) return setError("Nhập số giấy phép / ủy quyền.");

    setBusy(true);
    try {
      await config.register!({
        providerName: name.trim(),
        contactName: contactName.trim(),
        contactPhone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(config.needsLicense ? { licenseNumber: license.trim() } : {}),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof MobileApiError && err.uncertain) setUncertain(err.message);
      else setError(err instanceof Error ? err.message : "Chưa tạo được tài khoản. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-[34px]" aria-hidden="true">
          ✅
        </div>
        <h2 className="mt-2 text-[16px] font-extrabold text-emerald-800">Đã gửi đăng ký</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-emerald-700">
          Tài khoản đã được tạo. Bạn đăng nhập được ngay để hoàn thiện hồ sơ; Admin xác minh trước khi bạn gửi nội dung duyệt và mở
          liên hệ.
        </p>
        <Link href={ROUTES.congNhanLogin} className="mt-5 inline-block rounded-xl bg-brand-orange px-6 py-2.5 text-[13px] font-bold text-white">
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  if (uncertain) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center" role="alert">
        <div className="text-[34px]" aria-hidden="true">
          ⚠️
        </div>
        <h2 className="mt-2 text-[16px] font-extrabold text-amber-800">Chưa xác định tài khoản đã tạo hay chưa</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-amber-800">{uncertain}</p>
        <Link href={ROUTES.congNhanLogin} className="mt-5 inline-block rounded-xl bg-brand-orange px-6 py-2.5 text-[13px] font-bold text-white">
          Đi tới đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="block text-[12px] font-semibold text-brand-navy/60">
        Loại tài khoản
        <select
          name="accountType"
          value={type}
          onChange={(event) => {
            setType(event.target.value as AccountType);
            setError("");
          }}
          disabled={busy}
          className={inputClass}
        >
          {TYPE_ORDER.map((key) => (
            <option key={key} value={key}>
              {TYPES[key].label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
        {config.nameLabel}
        <input name="name" required minLength={2} placeholder={config.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} className={inputClass} />
      </label>

      {isPartner && (
        <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
          Người phụ trách
          <input name="contactName" required minLength={2} placeholder="Họ và tên người liên hệ" value={contactName} onChange={(e) => setContactName(e.target.value)} disabled={busy} className={inputClass} />
        </label>
      )}

      <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
        Số điện thoại liên hệ
        <input name="phone" type="tel" required minLength={9} placeholder="0909 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} className={inputClass} />
      </label>

      <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
        Email đăng nhập
        <input name="email" type="email" required placeholder="hr@congty.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} className={inputClass} />
      </label>

      <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
        Mật khẩu
        <input name="password" type="password" required minLength={8} placeholder="Tối thiểu 8 ký tự" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className={inputClass} />
      </label>

      {config.needsLicense && (
        <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
          Số giấy phép / ủy quyền
          <input name="license" required maxLength={80} value={license} onChange={(e) => setLicense(e.target.value)} disabled={busy} className={inputClass} />
        </label>
      )}

      {config.note && <p className="mt-3 text-[11.5px] leading-relaxed text-brand-navy/45">{config.note}</p>}

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-lg bg-brand-orange py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
      >
        {busy ? "Đang tạo tài khoản..." : "Tạo tài khoản →"}
      </button>
    </form>
  );
}
