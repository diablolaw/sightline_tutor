import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SightLine Tutor",
  description: "Vision-enabled algebra tutor with live voice interaction.",
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
