import type { Metadata } from "next";
import { Be_Vietnam_Pro, Lora } from "next/font/google";
import "./globals.css";
import "./font-overrides.css";
import "./auth-layout.css";
const sans = Be_Vietnam_Pro({
  variable: "--font-vietnamese-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const serif = Lora({
  variable: "--font-vietnamese-serif",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Nhật ký thực tập UEH",
  description: "Không gian ghi chép và hoàn thiện Nhật ký thực tập tốt nghiệp ngành Kiểm toán.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Nhật ký thực tập UEH", description: "Ghi chép, tổng hợp và hoàn thiện Nhật ký thực tập Kiểm toán 2026.", images: [{ url: "/og.png", width: 1733, height: 909, alt: "Nhật ký thực tập UEH · Kiểm toán 2026" }] },
  twitter: { card: "summary_large_image", title: "Nhật ký thực tập UEH", description: "Ghi chép, tổng hợp và hoàn thiện Nhật ký thực tập Kiểm toán 2026.", images: ["/og.png"] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>;
}
