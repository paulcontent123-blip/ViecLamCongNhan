"use client";

import { useState } from "react";
import { useInquirySubmit, validateContact } from "@/components/dichvucongnhan/hooks";
import { InquiryModal } from "@/components/dichvucongnhan/InquiryModal";
import { ConsentCheckbox, SelectField, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import { PROVINCES } from "@/lib/provinces";
import { nestedId, submitInquiry } from "@/lib/worker-service-client";
import {
  CONTACT_CONSENT_TEXT,
  FINANCE_PUBLIC_CATEGORY_LABEL,
  FINANCE_TOPIC_FIELD_LABEL,
  financeTopicsFor,
  SHARE_CONSENT_TEXT,
  WORKER_SERVICES,
  type FinanceCategory,
} from "@/lib/worker-services";
import type { FinanceProduct } from "@/types/worker-services";

const service = WORKER_SERVICES["tai-chinh"];
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
const EMPTY = { fullName: "", phone: "", email: "", provinceCode: "", destinationProvinceCode: "", message: "" };

export function FinanceInquiryForm({ product, onClose }: { product: FinanceProduct; onClose: () => void }) {
  const topics = financeTopicsFor(product.category);
  const [values, setValues] = useState(EMPTY);
  const [topic, setTopic] = useState(topics[0].value);
  const [consent, setConsent] = useState(false);
  const [share, setShare] = useState(false);
  const state = useInquirySubmit();
  const set = (key: keyof typeof EMPTY) => (value: string) => setValues((current) => ({ ...current, [key]: value }));

  // Chỉ nhóm "chuyển tiền về quê" mới có tỉnh/thành nhận tiền; máy chủ bỏ qua trường này với nhóm khác.
  const isRemittance = product.category === "remittance";
  const topicLabel =
    FINANCE_TOPIC_FIELD_LABEL[product.category as FinanceCategory] ?? "Chủ đề cần tư vấn *";

  function run() {
    state.submit(
      () => {
        const invalid = validateContact(values.fullName, values.phone);
        if (invalid) return invalid;
        if (!topic) return "Chọn nội dung bạn cần tư vấn.";
        if (!consent) return "Bạn cần đồng ý để Admin liên hệ tư vấn.";
        return null;
      },
      () =>
        submitInquiry(
          "finance/inquiries",
          {
            productId: product.id,
            topic,
            fullName: values.fullName.trim(),
            phone: values.phone.trim(),
            email: values.email.trim(),
            provinceCode: values.provinceCode,
            destinationProvinceCode: isRemittance ? values.destinationProvinceCode : "",
            message: values.message.trim(),
            contactConsent: true,
            ...(share ? { shareConsent: true } : {}),
          },
          (data) => nestedId(data, "inquiry"),
        ),
    );
  }

  return (
    <InquiryModal
      service={service}
      kicker={`Tư vấn ${(FINANCE_PUBLIC_CATEGORY_LABEL[product.category] ?? "tài chính").toLowerCase()}`}
      title="Yêu cầu tư vấn"
      subject={product.title}
      subjectNote={product.provider?.provider_name || "Đơn vị đã xác minh"}
      state={state}
      onClose={onClose}
      onSubmit={run}
      submitLabel="Gửi yêu cầu tư vấn"
      successTitle="Đã nhận yêu cầu"
      successNote="Admin sẽ liên hệ tư vấn theo thông tin bạn để lại. Bạn không cần gửi lại yêu cầu này."
      disclaimer="Đây chưa phải hồ sơ vay hay lệnh giao dịch. Không gửi số thẻ, mã OTP hay thông tin ngân hàng ở form này."
    >
      <SelectField
        label={topicLabel}
        name="topic"
        value={topic}
        onChange={setTopic}
        options={topics}
        disabled={state.locked}
        accent={service.accent}
      />
      <TextField
        label="Họ và tên *"
        name="fullName"
        value={values.fullName}
        onChange={set("fullName")}
        disabled={state.locked}
        maxLength={120}
        accent={service.accent}
      />
      <TextField
        label="Số điện thoại *"
        name="phone"
        type="tel"
        inputMode="tel"
        value={values.phone}
        onChange={set("phone")}
        disabled={state.locked}
        maxLength={20}
        accent={service.accent}
      />
      <TextField
        label="Email (không bắt buộc)"
        name="email"
        type="email"
        inputMode="email"
        value={values.email}
        onChange={set("email")}
        disabled={state.locked}
        maxLength={254}
        accent={service.accent}
      />
      <SelectField
        label="Tỉnh/thành bạn đang ở (không bắt buộc)"
        name="provinceCode"
        value={values.provinceCode}
        onChange={set("provinceCode")}
        options={PROVINCE_OPTIONS}
        placeholder="Chưa chọn"
        disabled={state.locked}
        accent={service.accent}
      />
      {isRemittance && (
        <SelectField
          label="Tỉnh/thành nhận tiền (không bắt buộc)"
          name="destinationProvinceCode"
          value={values.destinationProvinceCode}
          onChange={set("destinationProvinceCode")}
          options={PROVINCE_OPTIONS}
          placeholder="Chưa chọn"
          disabled={state.locked}
          accent={service.accent}
        />
      )}
      <TextAreaField
        label="Lời nhắn (không bắt buộc)"
        name="message"
        value={values.message}
        onChange={set("message")}
        disabled={state.locked}
        maxLength={1000}
        accent={service.accent}
      />
      <ConsentCheckbox
        checked={consent}
        onChange={setConsent}
        text={CONTACT_CONSENT_TEXT["tai-chinh"]}
        disabled={state.locked}
        accent={service.accent}
      />
      <ConsentCheckbox
        checked={share}
        onChange={setShare}
        text={SHARE_CONSENT_TEXT}
        disabled={state.locked}
        accent={service.accent}
      />
    </InquiryModal>
  );
}
