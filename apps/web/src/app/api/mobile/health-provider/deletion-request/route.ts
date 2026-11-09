import { accountDeletionRequestRoute } from "@/lib/account-deletion-request";
import { getHealthProviderSession } from "@/lib/health-provider-auth";

// Yêu cầu xóa tài khoản của chính chủ (Admin xác nhận). Dùng chung xử lý ở lib/account-deletion-request.ts.
const handlers = accountDeletionRequestRoute(getHealthProviderSession, "/api/mobile/health-provider/deletion-request");
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
