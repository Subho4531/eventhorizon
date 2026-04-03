# Project Structure

## Root Layout

```
/app                    # Next.js App Router pages and API routes
/components             # React components
/contracts              # Soroban smart contracts (Rust)
/circuit                # ZK circuits (Circom)
/lib                    # Utility functions and helpers
/prisma                 # Database schema and migrations
/public                 # Static assets
```

## App Directory (Next.js App Router)

```
/app/(dashboard)        # Dashboard layout group
  /admin                # Admin panel
  /dashboard            # User dashboard
  /leaderboard          # Rankings
  /markets              # Market browser
  /portfolio            # User positions
  layout.tsx            # Shared dashboard layout

/app/api                # API routes
  /bets                 # Bet operations
  /markets              # Market CRUD + resolution
  /users                # User profiles
  /transactions         # Transaction history
  /leaderboard          # Leaderboard data
```

## Components

```
/components
  /ui                   # Shadcn UI primitives
  AppLayout.tsx         # Main app wrapper
  BetModal.tsx          # ZK bet placement
  CreateMarketModal.tsx # Market creation
  Navbar.tsx            # Navigation
  WalletProvider.tsx    # Stellar wallet context
```

## Contracts

```
/contracts
  /prediction_market    # Main market contract
    /src/lib.rs         # Soroban contract logic
  /autopay              # ZK autopay contract
    /src/lib.rs         # Recurring payment logic
```

## Circuits

```
/circuit
  seal_bet.circom       # Generates commitment when betting
  reveal_bet.circom     # Proves position at claim time
  autopay.circom        # Recurring payment authorization
  escrow_deposit.circom # Escrow logic
  *_js/                 # Compiled WASM witnesses
  *.zkey                # Proving/verification keys
  *.ptau                # Powers of tau ceremony files
```

## Database (Prisma)

```
/prisma
  schema.prisma         # Data models: User, Market, Bet, Transaction
```

## Key Conventions

- API routes follow REST patterns: `/api/resource` and `/api/resource/[id]`
- Dashboard routes use route groups: `(dashboard)` for shared layouts
- ZK circuits follow naming: `seal_*` for commitment, `reveal_*` for proof
- Contract builds output to `target/wasm32-unknown-unknown/release/`
- Circuit artifacts stay in `/circuit` directory (not moved to public)
