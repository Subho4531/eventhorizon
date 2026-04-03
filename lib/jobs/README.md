# Background Jobs System

This directory contains the background job infrastructure for the Gravity prediction market intelligence system.

## Overview

The background jobs system provides automated, periodic updates for:
- Probability estimates
- Liquidity parameters
- Quality scores
- Manipulation detection

## Jobs

### Probability Updater (`probability-updater.ts`)
- **Interval**: 30 seconds
- **Batch Size**: 20 markets per batch
- **Logic**: 
  - Updates markets closing within 24h every cycle (30s)
  - Updates other markets every other cycle (60s effective)
  - Processes markets in batches for performance

### Liquidity Adjuster (`liquidity-adjuster.ts`)
- **Interval**: 300 seconds (5 minutes)
- **Batch Size**: 50 markets per batch
- **Logic**: 
  - Recalculates min bet size based on volume
  - Adjusts incentive multipliers for low-liquidity markets
  - Updates bond requirements based on volatility

### Quality Updater (`quality-updater.ts`)
- **Interval**: 3600 seconds (1 hour)
- **Batch Size**: 100 markets per batch
- **Logic**: 
  - Calculates quality scores using weighted formula
  - Updates market quality scores in database
  - Caches results for fast API access

### Manipulation Monitor (`manipulation-monitor.ts`)
- **Interval**: 5 seconds (polling)
- **Max Latency**: 10 seconds
- **Logic**: 
  - Polls for new bets since last check
  - Analyzes each bet for manipulation patterns
  - Generates alerts for suspicious activity

## Job Manager (`job-manager.ts`)

Central coordinator for all background jobs.

### Usage

```typescript
import { jobManager } from '@/lib/jobs/job-manager'

// Start all jobs
jobManager.startAll()

// Stop all jobs
jobManager.stopAll()

// Get status
const status = jobManager.getStatus()

// Check health
const healthy = jobManager.isHealthy()
```

### Auto-Start

Jobs automatically start in production mode via `lib/server-init.ts`.

## Error Handling

All jobs implement:
- **Exponential backoff**: Retries with increasing delays on transient failures
- **Graceful degradation**: Continue processing other items if one fails
- **Comprehensive logging**: All errors logged with context

## Performance

- **Batch processing**: Markets processed in configurable batches
- **Concurrent execution**: Uses `Promise.allSettled` for parallel processing
- **Skip protection**: Prevents overlapping cycles if previous run still in progress

## Monitoring

Check job status via API:
```bash
GET /api/jobs/status
```

Response:
```json
{
  "healthy": true,
  "started": true,
  "jobs": {
    "probabilityUpdater": {
      "running": true,
      "isProcessing": false,
      "lastUpdate": "2025-01-15T10:30:00Z",
      "cycleCount": 42
    },
    // ... other jobs
  }
}
```

## Configuration

Each job accepts configuration options:

```typescript
new ProbabilityUpdater({
  interval: 30000,    // milliseconds
  batchSize: 20,      // markets per batch
  enabled: true       // enable/disable
})
```

## Graceful Shutdown

Jobs automatically stop on SIGTERM/SIGINT signals for clean shutdown.
