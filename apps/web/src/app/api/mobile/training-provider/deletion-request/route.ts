import { accountDeletionRequestRoute } from "@/lib/account-deletion-request";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";

// Yêu cầu xóa tài khoản của chính chủ (Admin xác nhận). Dùng chung xử lý ở lib/account-deletion-request.ts.
const handlers = accountDeletionRequestRoute(getTrainingProviderSession, "/api/mobile/training-provider/deletion-request");
export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
