# Nosana Credit Fix

Bypasses SDK credit issues by using the CLI's `--api` flag with direct REST API calls.

## The Problem

- SDK requires `wallet` + gas (SOL) even when using USD credits
- SDK `ipfs.pin()` returns `undefined` silently
- API calls fail with "Invalid timeout" errors
- **CRITICAL: You need gas (SOL) to run jobs even if you have credits**
- **Credit system and crypto system are wired differently**

## ⚠️ Important Warnings

### You Still Need Gas (SOL)

Having USD credits does NOT eliminate the need for SOL gas. Every transaction on Solana requires gas fees:

```
❌ WRONG ASSUMPTION: "I have $50 in credits, I don't need SOL"
✅ CORRECT: Credits pay for GPU time, SOL pays for transaction fees
```

**What you need:**
- Minimum ~0.01 SOL in your wallet for gas fees
- USD credits at https://deploy.nosana.com for compute time

### What You Actually Need: SOL (not NOS)

**You need SOL for gas - NOT the NOS token.**

| What | Token/Currency | Purpose | Where to Get | Amount Needed |
|------|---------------|---------|--------------|---------------|
| **Gas fees** | SOL | Pay for Solana transactions | Any exchange, faucet | ~0.001-0.01 SOL per job |
| **Compute** | USD Credits | Pay for GPU time | https://deploy.nosana.com | $0.50-$5.00 per job |
| **NOT NEEDED** | NOS token | Staking/governance | Exchanges | 0 for credit jobs |

#### Why SOL Specifically?

Nosana runs on the **Solana blockchain**. Every job submission creates Solana transactions:

```
Job Submission Flow:
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Your Wallet   │────▶│  Solana RPC  │────▶│  Nosana Program │
│                 │     │              │     │                 │
│  - Signs tx     │     │  - Validates │     │  - Records job  │
│  - Pays ~0.005  │     │  - Charges   │     │  - Deducts      │
│    SOL for gas  │     │    gas fee   │     │    from credits │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

The gas fee goes to Solana validators, not to Nosana. You cannot pay Solana gas with anything except SOL.

#### Why NOS Token Isn't Used For Credit Jobs

For job submissions with credits:
- The smart contract reads from a **credit database**, not token balances
- Your API key maps to a fiat USD balance
- NOS token is never touched or referenced

```
Gas: Paid by wallet (SOL)
Compute: Paid by API key (USD credits)
NOS token: Not involved at all
```

#### Edge Cases

**What If You Have NOS But No SOL?**
```
❌ Job fails with "Insufficient funds for transaction"
Solana doesn't care about your NOS. It needs SOL.
```

**What If You Have SOL But No Credits?**
```
❌ Gas paid (~0.005 SOL), then job fails with "Insufficient credits"
You lost the SOL with nothing to show for it.
```

### Adding Credits vs NOS Are Completely Different

**⚠️ CRITICAL: There is NO way to add credits via the frontend currently**

This isn't a missing feature—it's an architectural constraint.

#### Why They're Different

| Aspect | NOS Token | USD Credits |
|--------|-----------|-------------|
| **Currency** | Cryptocurrency | Fiat (USD) |
| **Settlement** | On-chain (instant) | Off-chain (payment processor) |
| **How to Buy** | DEX swap (Jupiter, Raydium) | Credit card at deploy.nosana.com |
| **Can Use SDK** | Yes | No |
| **Can Use Frontend** | Yes | No |

#### Why There's No Frontend for Credits

Fiat purchases (USD) **cannot** be handled by smart contracts:
- Requires identity verification (KYC)
- Requires payment processor integration
- Requires backend database updates
- Cannot be done via wallet/DEX alone

```
NOS Token Path:
Frontend → Wallet signs → DEX swap → Token balance updates → Done

USD Credit Path:
deploy.nosana.com → Email login → Payment form → Backend processes → Done
```

#### The Only Way To Add Credits

1. Visit https://deploy.nosana.com
2. Log in with email/password (not wallet)
3. Complete identity verification
4. Pay with credit card or crypto
5. Credits appear on your API key

**No alternative exists:**
- ❌ SDK function? No
- ❌ Smart contract call? No (fiat can't be on-chain)
- ❌ CLI command? No
- ❌ Wallet integration? No

## The Solution

Use the CLI's `--api` flag which properly handles credit-based authentication:

```bash
nosana job post \
  --market 97G9NnvBDQ2WpKu6fasoMsAKmfj63C9rhysJnkeWodAf \
  --timeout 60 \
  --job /path/to/job.json \
  --api https://api.nosana.io
```

## Prerequisites Checklist

Before running:

1. ✅ `nosana` CLI installed globally
2. ✅ API key configured in `~/.nosana/config`
3. ✅ **At least 0.01 SOL in your wallet for gas**
4. ✅ Credits available at https://deploy.nosana.com

## Files

- `credit-submit.ts` - TypeScript wrapper around CLI
- `job-definition.json` - Sample video generation job
- `monitor.ts` - Poll job status until completion
- `api-examples.ts` - Production API implementations

## Usage

```typescript
import { submitWithCredits } from './credit-submit';

const job = await submitWithCredits({
  prompt: "cyborg playing basketball",
  duration: 4
});

console.log('Job submitted:', job.address);
```

## Debugging

If your job fails immediately:

```bash
# Check your SOL balance
solana balance YOUR_WALLET_ADDRESS

# Airdrop SOL on devnet (for testing)
solana airdrop 2

# Check credit balance
nosana account info --api https://api.nosana.io
```

## Requirements

- `nosana` CLI installed globally
- API key configured in `~/.nosana/config`
- **SOL in wallet for gas fees**
- Credits available at https://deploy.nosana.com

## API Implementation Examples

Production API endpoints using the credit bypass pattern:

- `POST https://ynvmaker.zo.space/api/submit-with-credits` - Submit jobs with CLI --api flag
- `GET https://ynvmaker.zo.space/api/credit-status` - Check credit balance + gas requirements  
- `POST https://ynvmaker.zo.space/api/credit-mana` - Credit "mana" (budget) operations

See `api-examples.ts` for the implementation code.

---

*Last updated: Production APIs at ynvmaker.zo.space*