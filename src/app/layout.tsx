import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess AI Coach Arena",
  description: "A startup-style chess learning platform with backend-ready game services.",
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
