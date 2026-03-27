import Link from 'next/link'
import { InspirationArchiveList } from '@/components/inspiration-archive-list'

export const dynamic = 'force-dynamic'

export default function InspirationArchivePage() {
  return (
    <main className="min-h-screen relative">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-24 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xs text-muted-foreground uppercase tracking-widest">随想录</h1>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← 返回首页
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">向下滚动自动加载更多</p>
        <InspirationArchiveList />
      </div>
    </main>
  )
}
