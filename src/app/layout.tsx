import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "宏福苑報平安【齋睇】",
  description: "宏福苑火警報平安試算表 - 只供查閱，如需報平安請用原始試算表",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-HK">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
