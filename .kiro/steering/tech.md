# Tech Stack

## Frontend
- Next.js 16.2.1 (App Router)
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Framer Motion (animations)
- Three.js + React Three Fiber (3D graphics)
- Lenis (smooth scrolling)

## Blockchain
- Stellar SDK 14.6.1
- Freighter wallet integration
- Soroban smart contracts (Rust)

## Zero-Knowledge
- Circom circuits (circomlib 2.0.5)
- SnarkJS 0.7.6
- Poseidon hash for commitments

## Database
- PostgreSQL (Neon serverless)
- Prisma ORM 7.6.0

## Build System

### Development
```bash
npm run dev          # Start Next.js dev server on localhost:3000
```

### Production
```bash
npm run build        # Build Next.js app
npm start            # Start production server
npm run lint         # Run ESLint
```

### Soroban Contracts
```bash
cd contracts/prediction_market
cargo build --target wasm32-unknown-unknown --release
```

### ZK Circuits
```bash
cd circuit
./setup.ps1          # Initial trusted setup
./build_all.ps1      # Compile all circuits
./setup_market.ps1   # Market-specific setup
```

## Important Notes

- Next.js 16+ has breaking changes from training data - check `node_modules/next/dist/docs/` before writing code
- Circuits use PowerShell scripts on Windows
- Database uses Neon adapter for serverless PostgreSQL
