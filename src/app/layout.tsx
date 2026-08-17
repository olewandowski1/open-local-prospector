import type { Metadata } from "next"
import { Geist_Mono, Outfit, Roboto_Slab } from "next/font/google"
import { cookies } from "next/headers"

import "@/app/globals.css"
import { QueryProvider } from "@/components/query-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  parseThemePreference,
  THEME_COOKIE,
  themeClassName,
  themeResolverScript,
} from "@/features/local-application/application/theme-preference"
import { ThemeProvider } from "@/features/local-application/presentation/theme-provider"
import { cn } from "@/lib/utils"

const robotoSlabHeading = Roboto_Slab({
  subsets: ["latin", "latin-ext"],
  variable: "--font-roboto-slab-heading",
})

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Local Prospector",
  description: "Find local businesses that could benefit from a better website.",
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value)

  return (
    <html
      lang="en"
      className={cn(
        "h-full font-sans antialiased",
        themeClassName(theme),
        geistMono.variable,
        outfit.variable,
        robotoSlabHeading.variable,
      )}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the system preference before paint so the first frame is never the wrong theme. */}
        <script suppressHydrationWarning>{themeResolverScript}</script>
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider theme={theme}>
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
