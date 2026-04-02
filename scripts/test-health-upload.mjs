#!/usr/bin/env node

const baseUrl = process.env.HEALTH_UPLOAD_URL || 'http://localhost:3000'
const token = process.env.HEALTH_API_TOKEN
const generatedHashKey = process.env.HEALTH_DEVICE_KEY

if (!token || !generatedHashKey) {
  console.error('Missing env: HEALTH_API_TOKEN and HEALTH_DEVICE_KEY are required.')
  process.exit(1)
}

const now = new Date().toISOString()
const sampleKey = `sample-${Date.now()}`

const payload = {
  generatedHashKey,
  device: process.env.HEALTH_DEVICE_NAME || 'Samsung Galaxy Watch',
  source: 'samsung_health',
  sampleKey,
  measuredAt: now,
  heartRate: 78,
  bloodOxygen: 98,
  stepCount: 1250,
  caloriesKcal: 88,
  sleepMinutes: 35,
  stressLevel: 20,
  payload: {
    origin: 'scripts/test-health-upload.mjs',
    note: 'sample upload',
  },
}

const uploadRes = await fetch(`${baseUrl}/api/health`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
})

const uploadText = await uploadRes.text()
console.log('[upload]', uploadRes.status, uploadText)

const summaryRes = await fetch(`${baseUrl}/api/health?public=1`)
const summaryText = await summaryRes.text()
console.log('[summary]', summaryRes.status, summaryText)

