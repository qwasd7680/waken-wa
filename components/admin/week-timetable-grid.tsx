'use client'

import { addDays, format, startOfWeek } from 'date-fns'

import type { ScheduleOccurrence } from '@/lib/schedule-courses'
import {
  parseTimeHmToMinutes,
  type ScheduleDayGrid,
} from '@/lib/schedule-grid-by-weekday'
import { cn } from '@/lib/utils'

/** One row height per 15 minutes (baseline density). */
const ROW_PX = 28
const PX_PER_MINUTE = ROW_PX / 15

const DEFAULT_DAY_START_MIN = 8 * 60
const DEFAULT_DAY_END_MIN = 22 * 60

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function formatMinuteLabel(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function occurrenceLayoutKey(o: ScheduleOccurrence): string {
  return `${o.courseId}-${o.start.getTime()}`
}

function maxConcurrentOnDay(events: ScheduleOccurrence[]): number {
  if (events.length === 0) return 1
  type Pt = { t: number; d: number }
  const pts: Pt[] = []
  for (const e of events) {
    pts.push({ t: e.start.getTime(), d: 1 })
    pts.push({ t: e.end.getTime(), d: -1 })
  }
  pts.sort((a, b) => (a.t === b.t ? a.d - b.d : a.t - b.t))
  let cur = 0
  let mx = 0
  for (const p of pts) {
    cur += p.d
    mx = Math.max(mx, cur)
  }
  return Math.max(1, mx)
}

function assignLanesForDay(events: ScheduleOccurrence[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())
  const laneEndMs: number[] = []
  const map = new Map<string, number>()
  for (const o of sorted) {
    const st = o.start.getTime()
    const en = o.end.getTime()
    let lane = -1
    for (let i = 0; i < laneEndMs.length; i++) {
      if (laneEndMs[i] <= st) {
        lane = i
        laneEndMs[i] = en
        break
      }
    }
    if (lane < 0) {
      lane = laneEndMs.length
      laneEndMs.push(en)
    }
    map.set(occurrenceLayoutKey(o), lane)
  }
  return map
}

function computeGlobalBounds(
  gridByWeekday: ScheduleDayGrid[],
  occurrences: ScheduleOccurrence[],
): { globalStart: number; globalEnd: number } {
  let gStart = DEFAULT_DAY_START_MIN
  let gEnd = DEFAULT_DAY_END_MIN
  for (const cfg of gridByWeekday) {
    const rs = parseTimeHmToMinutes(cfg.rangeStart)
    const re = parseTimeHmToMinutes(cfg.rangeEnd)
    if (rs !== null && re !== null) {
      gStart = Math.min(gStart, rs)
      gEnd = Math.max(gEnd, re)
    }
  }
  for (const o of occurrences) {
    const sm = minutesFromMidnight(o.start)
    const em = minutesFromMidnight(o.end)
    gStart = Math.min(gStart, sm)
    gEnd = Math.max(gEnd, em)
  }
  if (gEnd <= gStart) {
    gEnd = gStart + 60
  }
  return { globalStart: gStart, globalEnd: gEnd }
}

type WeekTimetableGridProps = {
  weekRef: Date
  gridByWeekday: ScheduleDayGrid[]
  occurrences: ScheduleOccurrence[]
  className?: string
}

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** Hour marks for free (non-fixed) grid mode within [rs, re). */
function hourTickMinutes(rs: number, re: number): number[] {
  const out: number[] = []
  const first = Math.ceil(rs / 60) * 60
  for (let m = first; m < re; m += 60) {
    out.push(m)
  }
  return out
}

export function WeekTimetableGrid({
  weekRef,
  gridByWeekday,
  occurrences,
  className,
}: WeekTimetableGridProps) {
  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 })
  const columnDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { globalStart, globalEnd } = computeGlobalBounds(gridByWeekday, occurrences)
  const totalMinutes = globalEnd - globalStart
  const totalHeight = Math.max(1, totalMinutes) * PX_PER_MINUTE

  const labelStep =
    gridByWeekday.length > 0
      ? Math.min(...gridByWeekday.map((d) => d.intervalMinutes))
      : 30
  const timeLabels: { m: number; text: string }[] = []
  for (let m = globalStart; m < globalEnd; m += labelStep) {
    timeLabels.push({ m, text: formatMinuteLabel(m) })
  }

  const byColumn = columnDays.map((day) => {
    const key = format(day, 'yyyy-MM-dd')
    return occurrences.filter((o) => format(o.start, 'yyyy-MM-dd') === key)
  })

  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-x-auto', className)}>
      <div className="min-w-[720px] flex text-xs">
        <div
          className="shrink-0 w-14 border-r border-border bg-muted/30 text-muted-foreground"
          style={{ paddingTop: ROW_PX }}
        >
          {timeLabels.map(({ m, text }, i) => (
            <div
              key={`${m}-${i}`}
              className="text-[10px] tabular-nums pr-1 text-right border-t border-border/60"
              style={{
                height: labelStep * PX_PER_MINUTE,
                lineHeight: `${Math.min(28, labelStep * PX_PER_MINUTE)}px`,
              }}
            >
              {text}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 border-l border-border">
          {columnDays.map((day, col) => {
            const cfg = gridByWeekday[col] ?? gridByWeekday[0]
            const dayEvents = byColumn[col]
            const maxLanes = maxConcurrentOnDay(dayEvents)
            const laneByKey = assignLanesForDay(dayEvents)
            const rs = parseTimeHmToMinutes(cfg.rangeStart) ?? DEFAULT_DAY_START_MIN
            const re = parseTimeHmToMinutes(cfg.rangeEnd) ?? DEFAULT_DAY_END_MIN

            const fixedTicks: number[] = []
            if (cfg.useFixedInterval) {
              for (let t = rs; t < re; t += cfg.intervalMinutes) {
                fixedTicks.push(t)
              }
            }

            const freeTicks = !cfg.useFixedInterval ? hourTickMinutes(rs, re) : []

            return (
              <div
                key={col}
                className="relative border-r border-border last:border-r-0 bg-background/50"
                style={{ minHeight: totalHeight + ROW_PX }}
              >
                <div
                  className="sticky top-0 z-20 border-b border-border bg-muted/40 py-1 text-center font-medium text-foreground"
                  style={{ height: ROW_PX }}
                >
                  <div>{WEEK_LABELS[col]}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {format(day, 'M/d')}
                  </div>
                </div>
                <div className="relative" style={{ height: totalHeight }}>
                  {cfg.useFixedInterval
                    ? fixedTicks.map((tickMin) => {
                        const y = (tickMin - globalStart) * PX_PER_MINUTE
                        if (tickMin < globalStart || tickMin >= globalEnd) return null
                        return (
                          <div
                            key={`f-${tickMin}`}
                            className="absolute left-0 right-0 border-t border-border/40 pointer-events-none"
                            style={{ top: y }}
                          />
                        )
                      })
                    : freeTicks.map((tickMin) => {
                        const y = (tickMin - globalStart) * PX_PER_MINUTE
                        if (tickMin < globalStart || tickMin >= globalEnd) return null
                        return (
                          <div
                            key={`h-${tickMin}`}
                            className="absolute left-0 right-0 border-t border-border/25 pointer-events-none"
                            style={{ top: y }}
                          />
                        )
                      })}
                  {dayEvents.map((o, idx) => {
                    const sm = minutesFromMidnight(o.start)
                    const em = minutesFromMidnight(o.end)
                    const top = (sm - globalStart) * PX_PER_MINUTE
                    const h = Math.max((em - sm) * PX_PER_MINUTE, ROW_PX * 0.75)
                    const lane = laneByKey.get(occurrenceLayoutKey(o)) ?? 0
                    const laneW = 100 / maxLanes
                    const gapPx = 2
                    const leftPct = lane * laneW
                    const titleSuffix =
                      o.sessionCount && o.sessionCount > 1 && o.sessionOrdinal
                        ? ` · 第${o.sessionOrdinal}/${o.sessionCount}段`
                        : ''
                    return (
                      <div
                        key={`${o.courseId}-${o.start.toISOString()}-${idx}`}
                        className="absolute rounded-md border border-primary/30 bg-primary/15 px-1 py-0.5 text-[10px] leading-tight text-foreground shadow-sm overflow-hidden z-10 box-border"
                        style={{
                          top,
                          height: h,
                          left: `calc(${leftPct}% + ${gapPx / 2}px)`,
                          width: `calc(${laneW}% - ${gapPx}px)`,
                        }}
                        title={`${o.title}${titleSuffix}${o.location ? ` · ${o.location}` : ''}${o.teacher ? ` · ${o.teacher}` : ''}`}
                      >
                        <div className="flex items-start justify-between gap-0.5 min-w-0">
                          <div className="font-medium truncate min-w-0 flex-1">{o.title}</div>
                          {o.sessionCount && o.sessionCount > 1 && o.sessionOrdinal ? (
                            <span className="shrink-0 rounded bg-primary/25 px-0.5 text-[9px] tabular-nums text-primary">
                              {o.sessionOrdinal}/{o.sessionCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="tabular-nums text-muted-foreground">
                          {format(o.start, 'HH:mm')}–{format(o.end, 'HH:mm')}
                        </div>
                        {h >= ROW_PX * 1.75 && o.location ? (
                          <div className="truncate text-muted-foreground">{o.location}</div>
                        ) : null}
                        {h >= ROW_PX * 2.25 && o.teacher ? (
                          <div className="truncate text-muted-foreground/90">{o.teacher}</div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
