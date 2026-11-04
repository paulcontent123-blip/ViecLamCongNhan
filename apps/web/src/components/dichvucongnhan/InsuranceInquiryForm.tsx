"use client";

import { useState } from "react";
import { useInquirySubmit, validateContact } from "@/components/dichvucongnhan/hooks";
import { InquiryModal } from "@/components/dichvucongnhan/InquiryModal";
import { ConsentCheckbox, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import { nestedId, submitInquiry } from "@/lib/worker-service-client";
import { CONTACT_CONSENT_TEXT, SHARE_CONSENT_TEXT, WORKER_SERVICES } from "@/lib/worker-services";
import type { InsuranceProduct } from "@/types/worker-services";

const service = WORKER_SERVICES["bao-hiem"];
const EMPTY = { fullName: "", phone: "", email: "", message: "" };

export function InsuranceInquiryForm({
  product,
  onClose,
}: {
  product: InsuranceProduct;
  onClose: () => void;
}) {
  const [values, setValues] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [share, setShare] = useState(false);
  const state = useInquirySubmit();
  const set = (key: keyof typeof EMPTY) => (value: string) => setValues((current) => ({ ...current, [key]: value }));

  function run() {
    state.submit(
      () => {
        const invalid = validateContact(values.fullName, values.phone);
        if (invalid) return invalid;
        if (!consent) return "Bạn cần đồng ý để đơn vị cung cấp liên hệ tư vấn.";
        return null;
      },
      () =>
        submitInquiry(
          "insurance/inquiries",
          {
            productId: product.id,
            fullName: values.fullName.trim(),
            phone: values.phone.trim(),
            email: values.email.trim(),
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
      kicker="Yêu cầu tư vấn bảo hiểm"
      title="Yêu cầu tư vấn"
      subject={product.title}
      subjectNote={product.provider?.provider_name || "Đơn vị cung cấp"}
      state={state}
      onClose={onClose}
      onSubmit={run}
      submitLabel="Gửi yêu cầu tư vấn"
      successTitle="Đã nhận yêu cầu"
      successNote="Đơn vị cung cấp sẽ liên hệ tư vấn theo thông tin bạn để lại. Bạn không cần gửi lại yêu cầu này."
      disclaimer="Đây là yêu cầu tư vấn, chưa phải hợp đồng bảo hiểm hay cam kết chi trả."
    >
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
      <TextAreaField
        label="Nội dung cần tư vấn (không bắt buộc)"
        name="message"
        value={values.message}
        onChange={set("message")}
        disabled={state.locked}
        maxLength={2000}
        accent={service.accent}
      />
      <ConsentCheckbox
        checked={consent}
        onChange={setConsent}
        text={CONTACT_CONSENT_TEXT["bao-hiem"]}
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
