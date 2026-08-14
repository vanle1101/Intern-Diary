import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
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
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>; }
