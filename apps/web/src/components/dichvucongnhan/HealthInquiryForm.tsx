"use client";

import { useState } from "react";
import { useInquirySubmit, validateContact } from "@/components/dichvucongnhan/hooks";
import { InquiryModal } from "@/components/dichvucongnhan/InquiryModal";
import { ConsentCheckbox, TextField } from "@/components/dichvucongnhan/ui";
import { nestedId, submitInquiry } from "@/lib/worker-service-client";
import { CONTACT_CONSENT_TEXT, todayInVietnam, WORKER_SERVICES } from "@/lib/worker-services";
import type { HealthService } from "@/types/worker-services";

const meta = WORKER_SERVICES["y-te"];

/**
 * Gửi yêu cầu liên hệ / đặt lịch một dịch vụ y tế.
 *
 * Route `health/inquiries` chỉ nhận họ tên, số điện thoại, ngày và khung giờ mong muốn ‑ KHÔNG có ô lời nhắn
 * hay email, và cũng không nhận `shareConsent`. Cố ý như vậy để không thu thập thông tin sức khỏe.
 */
export function HealthInquiryForm({ service, onClose }: { service: HealthService; onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [desiredDate, setDesiredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [consent, setConsent] = useState(false);
  const state = useInquirySubmit();

  function run() {
    state.submit(
      () => {
        const invalid = validateContact(fullName, phone);
        if (invalid) return invalid;
        // Máy chủ đòi đúng dạng YYYY-MM-DD; ô <input type="date"> cho ra dạng này, nhưng vẫn kiểm tra lại.
        if (desiredDate && !/^\d{4}-\d{2}-\d{2}$/.test(desiredDate)) return "Ngày mong muốn chưa đúng định dạng.";
        if (!consent) return "Bạn cần đồng ý để cơ sở y tế liên hệ.";
        return null;
      },
      () =>
        submitInquiry(
          "health/inquiries",
          {
            serviceId: service.id,
            fullName: fullName.trim(),
            phone: phone.trim(),
            desiredDate: desiredDate.trim(),
            preferredTime: preferredTime.trim(),
            contactConsent: true,
          },
          (data) => nestedId(data, "inquiry"),
        ),
    );
  }

  return (
    <InquiryModal
      service={meta}
      kicker="Yêu cầu liên hệ / đặt lịch"
      title="Gửi yêu cầu liên hệ"
      subject={service.title}
      subjectNote={service.provider?.provider_name || "Cơ sở y tế"}
      state={state}
      onClose={onClose}
      onSubmit={run}
      submitLabel="Gửi yêu cầu"
      successTitle="Đã gửi yêu cầu"
      successNote="Cơ sở sẽ liên hệ theo thông tin bạn cung cấp. Bạn không cần gửi lại yêu cầu này."
      disclaimer="Chỉ nhập thông tin để cơ sở liên hệ và hẹn lịch. Không gửi triệu chứng, bệnh sử, chẩn đoán hoặc hồ sơ khám tại đây."
    >
      <TextField
        label="Họ và tên *"
        name="fullName"
        value={fullName}
        onChange={setFullName}
        disabled={state.locked}
        maxLength={120}
        accent={meta.accent}
      />
      <TextField
        label="Số điện thoại *"
        name="phone"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={setPhone}
        disabled={state.locked}
        maxLength={20}
        accent={meta.accent}
      />
      <TextField
        label="Ngày mong muốn (không bắt buộc)"
        name="desiredDate"
        type="date"
        value={desiredDate}
        onChange={setDesiredDate}
        disabled={state.locked}
        min={todayInVietnam()}
        accent={meta.accent}
      />
      <TextField
        label="Khung giờ mong muốn (không bắt buộc)"
        name="preferredTime"
        value={preferredTime}
        onChange={setPreferredTime}
        disabled={state.locked}
        maxLength={60}
        placeholder="Ví dụ: sau 17h, sáng chủ nhật"
        accent={meta.accent}
      />
      <ConsentCheckbox
        checked={consent}
        onChange={setConsent}
        text={CONTACT_CONSENT_TEXT["y-te"]}
        disabled={state.locked}
        accent={meta.accent}
      />
    </InquiryModal>
  );
}
