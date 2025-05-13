import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "evr!t — Official",
  description:
    "Official site for evr!t. Follow on Instagram for the latest art, culture, and style updates.",
  openGraph: {
    title: "evr!t — Official",
    description: "Follow evr!t on Instagram for creative updates.",
    url: "https://evrit.xyz", // Update with actual domain
    siteName: "evr!t",
    images: [
      {
        url: "/og-image.jpg", // Add this image
        width: 800,
        height: 600,
        alt: "evr!t Instagram",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@evrit",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
