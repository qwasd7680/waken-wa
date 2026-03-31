import './globals.css'

import type { Metadata } from 'next'
import { Noto_Sans_SC } from 'next/font/google'

import { GlobalMouseTilt } from '@/components/global-mouse-tilt'
import { DEFAULT_PAGE_TITLE, PAGE_TITLE_MAX_LEN } from '@/lib/default-page-title'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

const notoSansSC = Noto_Sans_SC({ subsets: ["latin"], weight: ["300", "400", "500"] });

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_PAGE_TITLE
  try {
    const config = await getSiteConfigMemoryFirst()
    const raw = String(config?.pageTitle ?? '').trim()
    if (raw) {
      title = raw.slice(0, PAGE_TITLE_MAX_LEN)
    }
  } catch {
    // e.g. DB not ready during build or first boot
  }
  return { title }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let globalMouseTiltEnabled = false
  try {
    const row = await getSiteConfigMemoryFirst()
    globalMouseTiltEnabled = row?.globalMouseTiltEnabled === true
  } catch {
    // DB not ready during build or first boot
  }

  return (
    <html lang="zh-CN">
      <body className={`${notoSansSC.className} antialiased`}>
        <GlobalMouseTilt enabled={globalMouseTiltEnabled}>{children}</GlobalMouseTilt>
        <div id="site-footer-portal" />
      </body>
    </html>
  )
}
