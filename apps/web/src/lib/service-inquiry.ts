// Các loại yêu cầu dùng chung cho API công khai và khu vực quản trị.
// Có thể bổ sung thêm type cho Quảng cáo/Hợp tác mà không đổi cấu trúc bảng.
export const SERVICE_INQUIRY_TYPE_SERVICE_PACKAGE = "Dịch vụ trọn gói" as const;
export const SERVICE_INQUIRY_TYPE_ADVERTISING = "Quảng cáo/Hợp tác" as const;
export const SERVICE_INQUIRY_TYPE_SERVICE_PARTNER = "Đối tác dịch vụ" as const;
export const SERVICE_INQUIRY_TYPE_ADVERTISING_PRICING = "Bảng giá quảng cáo" as const;

export type PublicServiceInquiryKind = "service-package" | "advertising" | "service-partner" | "advertising-pricing";
