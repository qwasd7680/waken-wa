export interface HealthSummaryLatest {
  heartRate: number | null
  restingHeartRate: number | null
  bloodOxygen: number | null
  stepCount: number | null
  distanceMeters: number | null
  caloriesKcal: number | null
  sleepMinutes: number | null
  stressLevel: number | null
}

export interface HealthSummary {
  deviceName: string
  source: string
  measuredAt: string
  latest: HealthSummaryLatest
  totals24h: {
    stepCount: number
    caloriesKcal: number
    sleepMinutes: number
  }
}

