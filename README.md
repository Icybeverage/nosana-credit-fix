# Nosana Credit Fix

Bypasses SDK credit issues by using the CLI's `--api` flag with direct REST API calls.

## The Problem

- SDK requires `wallet` + gas (SOL) even when using USD credits
- SDK `ipfs.pin()` returns `undefined` silently
- API calls fail with "Invalid timeout" errors

## The Solution

Use the CLI's `--api` flag which properly handles credit-based authentication:

```bash
nosana job post \
  --market 97G9NnvBDQ2WpKu6fasoMsAKmfj63C9rhysJnkeWodAf \
  --timeout 60 \
  --job /path/to/job.json \
  --api https://api.nosana.io
```

## Files

- `credit-submit.ts` - TypeScript wrapper around CLI
- `job-definition.json` - Sample video generation job
- `monitor.ts` - Poll job status until completion

## Usage

```typescript
import { submitWithCredits } from './credit-submit';

const job = await submitWithCredits({
  prompt: "cyborg playing basketball",
  duration: 4
});

console.log('Job submitted:', job.address);
```

## Requirements

- `nosana` CLI installed globally
- API key configured in `~/.nosana/config`
- Credits available at https://deploy.nosana.com
