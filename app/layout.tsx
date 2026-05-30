import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tilleys Work Planner",
  description: "Accountancy deadline and work planner dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
