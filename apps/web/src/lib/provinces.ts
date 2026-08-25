// Danh sách 34 tỉnh/thành sau sáp nhập (hiệu lực từ 01/07/2025), dùng chung
// cho Hero search, form NTD, filter Tìm việc làm, seed KCN.
export const PROVINCES = [
  // Đồng bằng sông Hồng
  { code: "HN", name: "Hà Nội" },
  { code: "HP", name: "Hải Phòng" },
  { code: "BNI", name: "Bắc Ninh" },
  { code: "QNI", name: "Quảng Ninh" },
  { code: "HYN", name: "Hưng Yên" },
  { code: "NBI", name: "Ninh Bình" },
  // Trung du và miền núi phía Bắc
  { code: "TQU", name: "Tuyên Quang" },
  { code: "CBG", name: "Cao Bằng" },
  { code: "LCH", name: "Lai Châu" },
  { code: "LCA", name: "Lào Cai" },
  { code: "TNG", name: "Thái Nguyên" },
  { code: "DBI", name: "Điện Biên" },
  { code: "LSN", name: "Lạng Sơn" },
  { code: "SLA", name: "Sơn La" },
  { code: "PTH", name: "Phú Thọ" },
  // Bắc Trung Bộ
  { code: "THA", name: "Thanh Hóa" },
  { code: "NAN", name: "Nghệ An" },
  { code: "HTI", name: "Hà Tĩnh" },
  { code: "QTR", name: "Quảng Trị" },
  { code: "HUE", name: "Huế" },
  // Duyên hải Nam Trung Bộ và Tây Nguyên
  { code: "DNG", name: "Đà Nẵng" },
  { code: "QNG", name: "Quảng Ngãi" },
  { code: "GLA", name: "Gia Lai" },
  { code: "DLK", name: "Đắk Lắk" },
  { code: "KHA", name: "Khánh Hòa" },
  { code: "LDG", name: "Lâm Đồng" },
  // Đông Nam Bộ
  { code: "DNA", name: "Đồng Nai" },
  { code: "TNI", name: "Tây Ninh" },
  { code: "HCM", name: "TP. Hồ Chí Minh" },
  // Đồng bằng sông Cửu Long
  { code: "DTP", name: "Đồng Tháp" },
  { code: "AGI", name: "An Giang" },
  { code: "VLO", name: "Vĩnh Long" },
  { code: "CT", name: "Cần Thơ" },
  { code: "CMU", name: "Cà Mau" },
] as const;

export type ProvinceCode = (typeof PROVINCES)[number]["code"];

export function provinceName(code: string | null | undefined): string {
  return PROVINCES.find((p) => p.code === code)?.name ?? code ?? "";
}
