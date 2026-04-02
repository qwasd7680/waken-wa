import { Activity, Droplets, Flame, Footprints, Moon, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

import type { HealthSummary } from '@/types/health-model'

interface HealthSummaryCardProps {
  summary: HealthSummary | null
}

function formatMeasuredAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function Item({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/45 px-3 py-2">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  )
}

export function HealthSummaryCard({ summary }: HealthSummaryCardProps) {
  if (!summary) {
    return (
      <div className="border border-border rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground">
        暂无三星手表健康数据
      </div>
    )
  }

  return (
    <section className="border border-border rounded-lg bg-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">三星手表健康摘要</h3>
        <span className="text-xs text-muted-foreground">{formatMeasuredAt(summary.measuredAt)}</span>
      </div>

      <div className="text-xs text-muted-foreground">
        设备：{summary.deviceName} · 来源：{summary.source}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Item
          icon={<Activity className="h-3.5 w-3.5 text-primary/80" />}
          label="实时心率"
          value={summary.latest.heartRate != null ? `${summary.latest.heartRate} bpm` : '--'}
        />
        <Item
          icon={<ShieldCheck className="h-3.5 w-3.5 text-primary/80" />}
          label="血氧"
          value={summary.latest.bloodOxygen != null ? `${summary.latest.bloodOxygen}%` : '--'}
        />
        <Item
          icon={<Footprints className="h-3.5 w-3.5 text-primary/80" />}
          label="步数"
          value={`${summary.totals24h.stepCount}`}
        />
        <Item
          icon={<Flame className="h-3.5 w-3.5 text-primary/80" />}
          label="24h 消耗"
          value={`${summary.totals24h.caloriesKcal} kcal`}
        />
        <Item
          icon={<Moon className="h-3.5 w-3.5 text-primary/80" />}
          label="24h 睡眠"
          value={`${summary.totals24h.sleepMinutes} 分钟`}
        />
        <Item
          icon={<Droplets className="h-3.5 w-3.5 text-primary/80" />}
          label="压力"
          value={summary.latest.stressLevel != null ? `${summary.latest.stressLevel}` : '--'}
        />
      </div>
    </section>
  )
}




