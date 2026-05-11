import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "חיפוש בקטלוג הספרייה",
  description: "ממשק חיפוש ידידותי לקטלוג הספרייה העירונית לוד",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
