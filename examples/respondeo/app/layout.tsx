import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/lib/config";
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
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : // NEXT_PUBLIC_APP_URL is the documented setting and is what the auth
        // client and OpenAPI document already use. NEXT_PUBLIC_BASE_URL was
        // only ever read here and was never in .env.example; it stays as a
        // fallback so existing deployments that set it keep working.
        process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXT_PUBLIC_BASE_URL ||
          "http://localhost:3000",
  ),
  title: siteConfig.name,
  description: siteConfig.description,
  icons: {
    icon: [
      { url: "/icon_light.svg", media: "(prefers-color-scheme: light)" },
      { url: "/icon_dark.svg", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" expand={true} closeButton />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
