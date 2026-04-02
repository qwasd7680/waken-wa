# Samsung Watch Health Integration

This document explains how to upload Samsung watch health metrics to this site and render a summary on the home page.

## What was added

- DB table: `health_samples` (both PostgreSQL and SQLite schemas).
- Upload API: `POST /api/health` (Bearer API token required).
- Public summary API: `GET /api/health?public=1` (requires site lock satisfied when lock is enabled).
- Home UI card: `components/health-summary-card.tsx`, rendered in `app/page.tsx`.
- Sample uploader script: `scripts/test-health-upload.mjs` (`pnpm health:upload:sample`).

## Upload payload

```json
{
  "generatedHashKey": "watch-device-hash",
  "device": "Samsung Galaxy Watch",
  "source": "samsung_health",
  "sampleKey": "2026-04-02T08:30:00.000Z",
  "measuredAt": "2026-04-02T08:30:00.000Z",
  "heartRate": 78,
  "restingHeartRate": 60,
  "bloodOxygen": 98,
  "stepCount": 1250,
  "distanceMeters": 860,
  "caloriesKcal": 88,
  "sleepMinutes": 35,
  "stressLevel": 20,
  "payload": {
    "workoutType": "walk"
  }
}
```

Notes:

- At least one metric field must be present.
- `sampleKey` is optional, but recommended for idempotent upsert.
- Device onboarding follows existing device flow (`active`/`pending` + `autoAcceptNewDevices`).

## Quick try

1) Start app locally.
2) Create or reuse an active API Token from admin.
3) Pick a device hash key (new or existing).
4) Upload sample data.

```bash
HEALTH_UPLOAD_URL="http://localhost:3000"
HEALTH_API_TOKEN="<your_api_token>"
HEALTH_DEVICE_KEY="watch-device-hash"
pnpm health:upload:sample
```

Then open home page and check the "三星手表健康摘要" card.

