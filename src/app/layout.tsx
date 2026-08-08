export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { themeInitScript } from "@/lib/theme-script";
import { Providers } from "./providers";
import { ChatWidgetLoader } from "@/components/chatbot";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Evernaro — Real-Time Customer Flow Management",
  description:
    "Evernaro helps businesses manage queues, appointments, customer communication, notifications and the complete customer journey from one platform.",
  openGraph: {
    title: "Evernaro — Real-Time Customer Flow Management",
    description:
      "Let customers join your queue, book appointments, track their position, and know exactly when it's their turn.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Evernaro — Real-Time Customer Flow Management",
    description:
      "Let customers join your queue, book appointments, track their position, and know exactly when it's their turn.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <Providers>{children}</Providers>
        <ChatWidgetLoader />
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </body>
    </html>
  );
}
