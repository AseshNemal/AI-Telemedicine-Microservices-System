import type { Metadata } from "next";
import AppShell from "@/app/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Telemedicine Microservices System",
  description: "Distributed telemedicine starter using Go microservices and Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
