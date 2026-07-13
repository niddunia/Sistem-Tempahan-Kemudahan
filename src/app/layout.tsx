import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AppProviders } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistem e-Tempahan PLTT · JTM",
  description:
    "Sistem e-Tempahan Bilik Komputer & Dewan Kuliah Utama — Pusat Latihan Teknologi Tinggi (PLTT), Jabatan Tenaga Manusia (JTM), Kementerian Sumber Manusia Malaysia.",
  keywords: [
    "PLTT", "JTM", "e-Tempahan", "Booking System", "Malaysia",
    "Bilik Komputer", "Dewan Kuliah", "Government Tech",
  ],
  authors: [{ name: "PLTT · JTM" }],
  robots: { index: false, follow: false }, // Internal system
  icons: { icon: "/logo.svg" },
};

export const viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </AppProviders>
      </body>
    </html>
  );
}
