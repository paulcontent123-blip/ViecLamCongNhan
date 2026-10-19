import "server-only";

/** Send an OTP using an approved ZBS Template Message template. The template must expose {otp}. */
export async function sendCandidateOtp(phone: string, code: string): Promise<void> {
  const accessToken = process.env.ZALO_ZBS_ACCESS_TOKEN;
  const templateId = process.env.ZALO_CANDIDATE_OTP_TEMPLATE_ID;
  if (!accessToken || !templateId) throw new Error("Zalo OTP chưa được cấu hình.");

  const zaloPhone = `84${phone.slice(1)}`;
  const response = await fetch("https://business.openapi.zalo.me/message/template", {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: accessToken },
    body: JSON.stringify({ phone: zaloPhone, template_id: templateId, template_data: { otp: code } }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as { error?: number; message?: string } | null;
  if (!response.ok || !result || result.error !== 0) {
    throw new Error("Zalo không xác nhận gửi OTP.");
  }
}
