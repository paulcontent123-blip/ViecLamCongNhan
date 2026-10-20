import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthModalProvider } from "@/components/layout/AuthModalContext";
import { GoogleAnalytics } from "@/components/shared/GoogleAnalytics";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ViecLamCongNhan.com ‑ Hệ sinh thái việc làm cho công nhân",
  description:
    "Nền tảng tuyển dụng chuyên biệt cho công nhân phổ thông và lao động sản xuất tại các Khu công nghiệp trên 34 tỉnh thành.",
};

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <AuthModalProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthModalProvider>
        {gaMeasurementId ? <GoogleAnalytics measurementId={gaMeasurementId} /> : null}
      </body>
    </html>
  );
}
