import 'server-only'

import { desc, eq, gte } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { devices, healthSamples } from '@/lib/drizzle-schema'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'
import { toDbJsonValue } from '@/lib/sqlite-json'
import { coerceDbTimestampToIsoUtc } from '@/lib/timezone'
import type { HealthSummary } from '@/types/health-model'

const HEALTH_PAYLOAD_MAX_JSON_LENGTH = 8_000

const healthPayloadSchema = z
  .record(z.unknown())
  .optional()
  .refine((value) => {
    if (!value) return true
    return JSON.stringify(value).length <= HEALTH_PAYLOAD_MAX_JSON_LENGTH
  }, `payload is too large (max ${HEALTH_PAYLOAD_MAX_JSON_LENGTH} chars)`)

export const healthUploadSchema = z.object({
  generatedHashKey: z.string().trim().min(8).max(128),
  device: z.string().trim().max(200).optional(),
  sampleKey: z.string().trim().max(120).optional(),
  source: z.string().trim().max(40).optional().default('samsung_health'),
  measuredAt: z.string().datetime().optional(),
  heartRate: z.number().int().min(20).max(260).optional(),
  restingHeartRate: z.number().int().min(20).max(220).optional(),
  bloodOxygen: z.number().int().min(0).max(100).optional(),
  stepCount: z.number().int().min(0).max(300000).optional(),
  distanceMeters: z.number().int().min(0).max(500000).optional(),
  caloriesKcal: z.number().int().min(0).max(50000).optional(),
  sleepMinutes: z.number().int().min(0).max(24 * 60).optional(),
  stressLevel: z.number().int().min(0).max(100).optional(),
  payload: healthPayloadSchema,
})

export type HealthUploadParsed = z.infer<typeof healthUploadSchema>

export async function insertHealthSample(input: {
  deviceId: number
  generatedHashKey: string
  sample: HealthUploadParsed
}): Promise<void> {
  const measuredAt = input.sample.measuredAt ? new Date(input.sample.measuredAt) : new Date()

  await db
    .insert(healthSamples)
    .values({
      deviceId: input.deviceId,
      generatedHashKey: input.generatedHashKey,
      sampleKey: input.sample.sampleKey,
      source: input.sample.source,
      measuredAt: sqlDate(measuredAt),
      heartRate: input.sample.heartRate,
      restingHeartRate: input.sample.restingHeartRate,
      bloodOxygen: input.sample.bloodOxygen,
      stepCount: input.sample.stepCount,
      distanceMeters: input.sample.distanceMeters,
      caloriesKcal: input.sample.caloriesKcal,
      sleepMinutes: input.sample.sleepMinutes,
      stressLevel: input.sample.stressLevel,
      payload: toDbJsonValue(input.sample.payload ?? null),
      createdAt: sqlTimestamp(),
    } as never)
    .onConflictDoUpdate({
      target: [healthSamples.generatedHashKey, healthSamples.sampleKey],
      set: {
        measuredAt: sqlDate(measuredAt),
        source: input.sample.source,
        heartRate: input.sample.heartRate,
        restingHeartRate: input.sample.restingHeartRate,
        bloodOxygen: input.sample.bloodOxygen,
        stepCount: input.sample.stepCount,
        distanceMeters: input.sample.distanceMeters,
        caloriesKcal: input.sample.caloriesKcal,
        sleepMinutes: input.sample.sleepMinutes,
        stressLevel: input.sample.stressLevel,
        payload: toDbJsonValue(input.sample.payload ?? null),
      } as never,
    })
}

export async function findActiveDeviceByHash(generatedHashKey: string) {
  const [row] = await db
    .select({
      id: devices.id,
      displayName: devices.displayName,
      status: devices.status,
      apiTokenId: devices.apiTokenId,
    })
    .from(devices)
    .where(eq(devices.generatedHashKey, generatedHashKey))
    .limit(1)
  return row ?? null
}

export async function getLatestHealthSummary(): Promise<HealthSummary | null> {
  const [latest] = await db
    .select({
      deviceName: devices.displayName,
      source: healthSamples.source,
      measuredAt: healthSamples.measuredAt,
      heartRate: healthSamples.heartRate,
      restingHeartRate: healthSamples.restingHeartRate,
      bloodOxygen: healthSamples.bloodOxygen,
      stepCount: healthSamples.stepCount,
      distanceMeters: healthSamples.distanceMeters,
      caloriesKcal: healthSamples.caloriesKcal,
      sleepMinutes: healthSamples.sleepMinutes,
      stressLevel: healthSamples.stressLevel,
    })
    .from(healthSamples)
    .innerJoin(devices, eq(healthSamples.deviceId, devices.id))
    .orderBy(desc(healthSamples.measuredAt))
    .limit(1)

  if (!latest?.measuredAt) return null

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      stepCount: healthSamples.stepCount,
      caloriesKcal: healthSamples.caloriesKcal,
      sleepMinutes: healthSamples.sleepMinutes,
    })
    .from(healthSamples)
    .where(gte(healthSamples.measuredAt, sqlDate(cutoff)))

  const totals24h: HealthSummary['totals24h'] = {
    stepCount: 0,
    caloriesKcal: 0,
    sleepMinutes: 0,
  }
  for (const row of rows as Array<{ stepCount: number | null; caloriesKcal: number | null; sleepMinutes: number | null }>) {
    totals24h.stepCount += row.stepCount ?? 0
    totals24h.caloriesKcal += row.caloriesKcal ?? 0
    totals24h.sleepMinutes += row.sleepMinutes ?? 0
  }

  return {
    deviceName: latest.deviceName,
    source: latest.source,
    measuredAt: coerceDbTimestampToIsoUtc(latest.measuredAt),
    latest: {
      heartRate: latest.heartRate,
      restingHeartRate: latest.restingHeartRate,
      bloodOxygen: latest.bloodOxygen,
      stepCount: latest.stepCount,
      distanceMeters: latest.distanceMeters,
      caloriesKcal: latest.caloriesKcal,
      sleepMinutes: latest.sleepMinutes,
      stressLevel: latest.stressLevel,
    },
    totals24h,
  }
}





