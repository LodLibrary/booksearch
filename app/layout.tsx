import "./globals.css";
import type { Metadata } from "next";
import { Assistant } from "next/font/google";

const assistant = Assistant({ subsets: ["hebrew", "latin"] });

export const metadata: Metadata = {
  title: "חיפוש בקטלוג הספרייה",
  description: "ממשק חיפוש ידידותי לקטלוג הספרייה העירונית לוד",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={assistant.className}>{children}</body>
    </html>
  );
}
