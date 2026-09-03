import Script from "next/script";

/**
 * Nhúng Google Analytics 4 (gtag.js).
 *
 * Chỉ render khi NEXT_PUBLIC_GA_ID có giá trị — nhờ vậy môi trường dev và
 * các bản build thử không bắn dữ liệu rác vào property thật.
 *
 * Lưu ý: đây là biến NEXT_PUBLIC_* nên giá trị được nhúng cứng vào HTML lúc
 * `next build`. Đổi ID thì phải build lại, restart app không đủ.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
