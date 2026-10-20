import type { Metadata } from "next"
import { Geist, Geist_Mono, STIX_Two_Text } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { WebVitals } from "@/components/shared/web-vitals"
import { cn } from "@workspace/ui/lib/utils"

export const metadata: Metadata = {
  title: {
    default: "spark",
    template: "%s | spark",
  },
  description: "Next.js 16.4 + React 19 Monorepo Base",
}

const fontSans = Geist({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
})

// Registered for `font-serif` only; no component uses it by default.
const fontSerif = STIX_Two_Text({
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  preload: false,
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        fontSans.variable,
        fontSerif.variable
      )}
    >
      <body>
        <ThemeProvider>
          {children}
          <WebVitals />
        </ThemeProvider>
      </body>
    </html>
  )
}
