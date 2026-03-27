import { isAllowedSlotMinutes, type ScheduleSlotMinutes } from '@/lib/schedule-courses'

/** Monday = 0 … Sunday = 6 */
export const SCHEDULE_GRID_WEEKDAY_COUNT = 7

export type ScheduleDayGrid = {
  /** HH:mm */
  rangeStart: string
  /** HH:mm, same calendar day as rangeStart (rangeEnd > rangeStart) */
  rangeEnd: string
  intervalMinutes: ScheduleSlotMinutes
  /** When true, draw grid lines at rangeStart + k * interval. When false, only hourly guide lines. */
  useFixedInterval: boolean
}

const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseTimeHmToMinutes(hm: string): number | null {
  const m = HM_RE.exec(String(hm).trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function defaultScheduleDayGrid(legacySlotMinutes: number): ScheduleDayGrid {
  const slot = isAllowedSlotMinutes(legacySlotMinutes) ? legacySlotMinutes : 30
  return {
    rangeStart: '08:00',
    rangeEnd: '22:00',
    intervalMinutes: slot,
    useFixedInterval: true,
  }
}

/** Seven entries Mon–Sun, same defaults from legacy `scheduleSlotMinutes`. */
export function defaultScheduleGridByWeekday(legacySlotMinutes: number): ScheduleDayGrid[] {
  const d = defaultScheduleDayGrid(legacySlotMinutes)
  return Array.from({ length: SCHEDULE_GRID_WEEKDAY_COUNT }, () => ({ ...d }))
}

export function resolveScheduleGridByWeekday(
  rawJson: unknown,
  legacySlotMinutes: number,
): ScheduleDayGrid[] {
  const n = normalizeScheduleGridByWeekday(rawJson, legacySlotMinutes)
  return n.ok ? n.data : defaultScheduleGridByWeekday(legacySlotMinutes)
}

export function minIntervalFromGrid(grid: ScheduleDayGrid[]): ScheduleSlotMinutes {
  if (grid.length === 0) return 30
  let m = grid[0].intervalMinutes
  for (const d of grid) {
    if (d.intervalMinutes < m) m = d.intervalMinutes
  }
  return m
}

export function normalizeScheduleGridByWeekday(
  raw: unknown,
  legacySlotMinutes: number,
):
  | { ok: true; data: ScheduleDayGrid[] }
  | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length !== SCHEDULE_GRID_WEEKDAY_COUNT) {
    return { ok: false, error: 'scheduleGridByWeekday must be an array of length 7' }
  }
  const out: ScheduleDayGrid[] = []
  for (let i = 0; i < SCHEDULE_GRID_WEEKDAY_COUNT; i += 1) {
    const item = raw[i]
    if (item === null || typeof item !== 'object') {
      return { ok: false, error: `scheduleGridByWeekday[${i}] must be an object` }
    }
    const o = item as Record<string, unknown>
    const rangeStart = String(o.rangeStart ?? '').trim()
    const rangeEnd = String(o.rangeEnd ?? '').trim()
    const rs = parseTimeHmToMinutes(rangeStart)
    const re = parseTimeHmToMinutes(rangeEnd)
    if (rs === null || re === null) {
      return {
        ok: false,
        error: `scheduleGridByWeekday[${i}]: invalid rangeStart/rangeEnd (use HH:mm)`,
      }
    }
    if (re <= rs) {
      return {
        ok: false,
        error: `scheduleGridByWeekday[${i}]: rangeEnd must be after rangeStart`,
      }
    }
    const intervalMinutes = Number(o.intervalMinutes)
    if (!isAllowedSlotMinutes(intervalMinutes)) {
      return {
        ok: false,
        error: `scheduleGridByWeekday[${i}]: intervalMinutes must be 15, 30, 45, or 60`,
      }
    }
    const useFixedInterval = Boolean(o.useFixedInterval)
    out.push({
      rangeStart,
      rangeEnd,
      intervalMinutes,
      useFixedInterval,
    })
  }
  return { ok: true, data: out }
}
