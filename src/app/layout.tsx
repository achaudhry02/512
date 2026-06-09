import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Convenience Store Command Center",
  description:
    "Track sales, expenses, fuel, lottery, deli, payroll, and profit for convenience stores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
