export interface HealthUploadPayload {
  generatedHashKey: string
  device?: string
  sampleKey?: string
  source?: string
  measuredAt?: string
  heartRate?: number
  restingHeartRate?: number
  bloodOxygen?: number
  stepCount?: number
  distanceMeters?: number
  caloriesKcal?: number
  sleepMinutes?: number
  stressLevel?: number
  payload?: Record<string, unknown>
}

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

export {}


