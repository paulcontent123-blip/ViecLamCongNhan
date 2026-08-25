// Layout riêng cho /tim-viec-lam để khai báo parallel route slot "@modal" —
// cần thiết cho intercepting route (xem app/tim-viec-lam/@modal). Không thêm
// khung UI gì khác ở đây, Navbar/Footer đã có ở root layout.
export default function TimViecLamLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
