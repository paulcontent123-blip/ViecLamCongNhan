"use client";

import { useState } from "react";
import { useInquirySubmit, validateContact } from "@/components/dichvucongnhan/hooks";
import { InquiryModal } from "@/components/dichvucongnhan/InquiryModal";
import { ConsentCheckbox, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import { nestedId, submitInquiry } from "@/lib/worker-service-client";
import { CONTACT_CONSENT_TEXT, WORKER_SERVICES } from "@/lib/worker-services";

const service = WORKER_SERVICES["thue-tro"];
const EMPTY = { fullName: "", phone: "", email: "", message: "" };

/**
 * Gửi yêu cầu tìm hiểu một tin cho thuê.
 *
 * Khác các khu còn lại: route `rentals/inquiries` KHÔNG nhận `shareConsent`, chỉ có `contactConsent` bắt buộc,
 * và chia sẻ liên hệ ở đây là cho chính chủ trọ của tin đó (không qua Admin).
 */
export function RentalInquiryForm({
  listingId,
  listingTitle,
  providerName,
  onClose,
}: {
  listingId: string;
  listingTitle: string;
  providerName?: string | null;
  onClose: () => void;
}) {
  const [values, setValues] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const state = useInquirySubmit();
  const set = (key: keyof typeof EMPTY) => (value: string) => setValues((current) => ({ ...current, [key]: value }));

  function run() {
    state.submit(
      () => {
        const invalid = validateContact(values.fullName, values.phone);
        if (invalid) return invalid;
        if (!consent) return "Bạn cần đồng ý chia sẻ thông tin liên hệ với chủ trọ của tin này.";
        return null;
      },
      () =>
        submitInquiry(
          "rentals/inquiries",
          {
            listingId,
            fullName: values.fullName.trim(),
            phone: values.phone.trim(),
            email: values.email.trim(),
            message: values.message.trim(),
            contactConsent: true,
          },
          (data) => nestedId(data, "inquiry"),
        ),
    );
  }

  return (
    <InquiryModal
      service={service}
      kicker="Yêu cầu thuê trọ"
      title="Gửi yêu cầu tìm hiểu phòng"
      subject={listingTitle}
      subjectNote={providerName ? `Đơn vị cho thuê: ${providerName}` : "Đối tác đã xác minh"}
      state={state}
      onClose={onClose}
      onSubmit={run}
      submitLabel="Gửi yêu cầu"
      successTitle="Đã gửi yêu cầu"
      successNote="Chủ trọ sẽ liên hệ theo số điện thoại bạn để lại. Bạn không cần gửi lại yêu cầu này."
      disclaimer="Đây là yêu cầu tìm hiểu phòng, chưa phải đặt cọc hay hợp đồng thuê."
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
        label="Lời nhắn (không bắt buộc)"
        name="message"
        value={values.message}
        onChange={set("message")}
        disabled={state.locked}
        maxLength={2000}
        placeholder="Ví dụ: cần xem phòng cuối tuần, đi làm ở KCN nào…"
        accent={service.accent}
      />
      <ConsentCheckbox
        checked={consent}
        onChange={setConsent}
        text={CONTACT_CONSENT_TEXT["thue-tro"]}
        disabled={state.locked}
        accent={service.accent}
      />
    </InquiryModal>
  );
}
