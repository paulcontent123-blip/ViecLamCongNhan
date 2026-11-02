import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { providerServiceInquiriesResponse } from "@/lib/provider-service-inquiries";

// Dịch vụ/quảng cáo đã gửi bằng số điện thoại của tài khoản đối tác (chỉ đọc).
export async function GET() {
  return providerServiceInquiriesResponse(getRentalProviderSession, "rental_providers");
}
