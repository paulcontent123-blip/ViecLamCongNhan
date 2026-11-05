import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

// Đăng nhập đã gộp một ô chung ở /dang-nhap; giữ đường dẫn cũ để liên kết đã chia sẻ vẫn dùng được.
export default function CongNhanLoginRedirect() {
  redirect(ROUTES.congNhanLogin);
}
