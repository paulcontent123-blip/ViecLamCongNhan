// Bắt buộc phải có cho parallel route slot: khi URL hiện tại không khớp route
// nào bên trong @modal (vd: đang ở /tim-viec-lam bình thường, không có modal
// nào cần hiện), Next.js render default.tsx này ‑ trả về null để không hiện gì.
export default function Default() {
  return null;
}
