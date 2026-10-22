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
  description: "Spark turns goals into daily habits, tasks and check-ins, with a cat that grows as you follow through.",
}

// `subsets` only picks which files are preloaded; every subset keeps its @font-face, so Vietnamese
// text in user content still loads on demand (unicode-range) without a preload the English UI never uses.
const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
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
