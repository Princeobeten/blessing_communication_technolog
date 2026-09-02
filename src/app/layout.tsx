import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CRMS - Computer Repair Management System",
    template: "%s | CRMS",
  },
  description:
    "Computer Repair Management System - customer intake, repair tracking, spare-part inventory, billing and reporting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
