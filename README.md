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

### What You Actually Need: SOL (not NOS) - Technical Deep Dive

**You need SOL for gas - NOT the NOS token.**

| What | Token/Currency | Purpose | Where to Get | Amount Needed |
|------|---------------|---------|--------------|---------------|
| **Gas fees** | SOL | Pay for Solana transactions | Any exchange, faucet | ~0.001-0.01 SOL per job |
| **Compute** | USD Credits | Pay for GPU time | https://deploy.nosana.com | $0.50-$5.00 per job |
| **NOT NEEDED** | NOS token | Staking/governance | Exchanges (Jupiter, Raydium) | 0 for credit jobs |

#### Why SOL Specifically?

Nosana runs on the **Solana blockchain**, not its own chain. Every job submission creates one or more Solana transactions:

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

#### What Happens At The Blockchain Level

When you run `nosana job post`:

1. **Gas Payment (SOL)**: Immediate, mandatory, happens first
   ```javascript
   // Solana transaction structure
   {
     feePayer: YOUR_WALLET,      // Must have SOL
     instructions: [POST_JOB],    // Calls Nosana program
     recentBlockhash: "...",
     signatures: [YOUR_SIGNATURE]
   }
   ```

2. **Compute Payment (USD Credits)**: Happens AFTER gas is paid
   - The Nosana program checks your API key's credit balance
   - Deducts estimated GPU cost from your USD credits
   - If credits insufficient, transaction FAILS (but you still paid gas!)

#### Why NOS Token Isn't Used For Credit Jobs

NOS token has two purposes:
1. **Staking**: Lock NOS to become a node operator
2. **Governance**: Vote on protocol changes

For job submissions with credits:
- The smart contract reads from a **credit database**, not token balances
- Your API key maps to a fiat USD balance
- NOS token is never touched or referenced

```typescript
// Pseudocode of Nosana smart contract logic
function submitJob(apiKey, jobDefinition) {
  // Gas is paid by wallet (SOL)
  require(wallet.balance >= gasFee, "Insufficient SOL");
  
  // Compute is paid by credits (USD)
  const creditBalance = creditDatabase.get(apiKey);
  require(creditBalance >= jobCost, "Insufficient credits");
  
  // NOS token is NOT checked or used
  // const nosBalance = tokenAccount.get(wallet); // Skipped!
  
  creditDatabase.deduct(apiKey, jobCost);
  jobQueue.add(jobDefinition);
}
```

#### Edge Case: What If You Have NOS But No SOL?

```
Scenario: You have 1000 NOS tokens, 0 SOL, $10 credits
Result: ❌ Job fails immediately

Error: "Insufficient funds for transaction"
Why: Solana doesn't care about your NOS. It needs SOL.
```

#### Edge Case: What If You Have SOL But No Credits?

```
Scenario: You have 0.1 SOL, $0 credits
Result: ❌ Gas paid (~0.005 SOL), then job fails

Error: "Insufficient credits"
Why: Gas succeeded, but credit check failed. You lost the SOL.
```

### Adding Credits vs NOS Are Completely Different - Architecture Deep Dive

**⚠️ CRITICAL: There is NO way to add credits via the frontend currently**

This isn't a missing feature—it's an architectural constraint. Here's why:

#### Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                     NOS TOKEN PURCHASE                          │
│                         (Frontend Possible)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Wallet ──▶ Jupiter/Raydium DEX ──▶ Token Account Update   │
│                                                                 │
│  • Pure smart contract interaction                              │
│  • No KYC required                                              │
│  • No payment processor                                         │
│  • Instant on-chain settlement                                  │
│  • Wallet signs = transaction executes                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     USD CREDITS PURCHASE                        │
│                      (Backend Only)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User ──▶ Credit Card / Crypto ──▶ Payment Processor            │
│                                          │                      │
│                                          ▼                      │
│                                ┌─────────────────┐              │
│                                │  Stripe / Circle │              │
│                                │  (KYC Required)  │              │
│                                └────────┬────────┘              │
│                                         │                       │
│                                         ▼                       │
│                                ┌─────────────────┐              │
│                                │  Nosana Backend  │              │
│                                │  Credit Database │              │
│                                └────────┬────────┘              │
│                                         │                       │
│                                         ▼                       │
│                                API Key Credit Balance           │
│                                                                 │
│  • Requires payment processor (Stripe)                          │
│  • KYC/AML compliance required                                    │
│  • Fiat currency handling                                         │
│  • Tax reporting obligations                                      │
│  • Off-chain database update                                      │
│  • Cannot be done via smart contract alone                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Why There's No Smart Contract for Credit Purchases

Credit purchases involve **fiat currency**, which cannot be handled by smart contracts:

| Aspect | NOS Token | USD Credits |
|--------|-----------|-------------|
| **Currency** | Cryptocurrency (NOS) | Fiat (USD) |
| **Settlement** | On-chain (instant) | Off-chain (Stripe) |
| **KYC** | None required | Required by law |
| **Smart Contract** | Yes (SPL token) | No (impossible) |
| **Chargebacks** | Impossible | Possible (credit cards) |
| **Tax Reporting** | User responsibility | Platform must report |

#### The Database Architecture

Nosana maintains TWO separate balance systems:

```typescript
// Database Schema (simplified)

// 1. Token Balances (Solana blockchain)
interface TokenAccount {
  owner: PublicKey;        // Wallet address
  mint: PublicKey;         // NOS token mint
  amount: bigint;          // NOS token balance
}

// 2. Credit Balances (Nosana backend PostgreSQL)
interface CreditAccount {
  apiKey: string;          // Your API key
  userId: string;          // Internal user ID
  balanceUsd: number;      // USD credit balance
  stripeCustomerId: string; // For payment processing
  kycVerified: boolean;    // KYC status
  createdAt: Date;
}
```

These systems are completely isolated:
- Token balances are on-chain, public, permissionless
- Credit balances are off-chain, private, KYC-gated

#### Why You Can't Add Credits Via Frontend SDK

```typescript
// What users want (IMPOSSIBLE):
import { createNosanaClient } from '@nosana/kit';

const client = createNosanaClient('mainnet', {
  api: { apiKey: 'xxx' }
});

// ❌ This doesn't exist and can't exist
await client.credits.addFunds({
  amount: 50,  // $50
  paymentMethod: 'credit_card'  // Requires Stripe integration
});
```

**Why it's impossible:**

1. **Stripe Integration**: Credit card processing requires Stripe.js, which cannot run in a decentralized SDK
2. **PCI Compliance**: Handling credit cards requires PCI DSS compliance—something SDKs cannot achieve
3. **KYC Requirements**: Fiat purchases require identity verification (upload ID, proof of address)
4. **Backend Webhooks**: Stripe sends webhooks to Nosana's servers, not to your browser
5. **Tax Reporting**: Nosana must report credit purchases to tax authorities—requires backend records

#### The Only Way To Add Credits

```
Current Flow (Backend Only):

1. User visits https://deploy.nosana.com
2. Logs in with email/password (not wallet)
3. Completes KYC (upload ID document)
4. Enters credit card or crypto payment info
5. Stripe processes payment
6. Nosana backend updates credit balance
7. API key now has USD credits

No Frontend Alternative Exists:
❌ SDK function? No
❌ Smart contract call? No (impossible for fiat)
❌ CLI command? No
❌ Wallet integration? No
```

#### Why This Creates Confusion

Most crypto protocols work like this:
```
Need tokens? → Buy on DEX → Done (all on-chain)
```

Nosana credit system works like this:
```
Need credits? → Visit deploy.nosana.com → Complete KYC → Pay with card → Done (off-chain)
```

This hybrid model (crypto gas + fiat compute) is unusual and causes confusion. Most users expect everything to be on-chain.

#### The API Key vs Wallet Architecture

This is the root of the "wired differently" problem:

```
NOS Token Path:
Wallet (holds SOL + NOS) 
  → Signs transactions
  → Smart contract validates token balance
  → Job runs

USD Credit Path:
API Key (holds credit balance)
  + Wallet (holds SOL for gas)
  → Wallet signs (pays gas)
  → API key authenticates (pays compute)
  → Job runs
```

Two different authentication systems:
1. **Cryptographic**: Wallet signature proves ownership
2. **API Key**: Secret token proves account access

They serve different purposes and cannot be unified into a single frontend flow.

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

## Usage

```typescript
import { submitWithCredits } from './credit-submit';

const job = await submitWithCredits({
  prompt: "cyborg playing basketball",
  duration: 4
});

console.log('Job submitted:', job.address);
```

## Debugging Gas Issues

If your job fails immediately with "insufficient funds":

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
