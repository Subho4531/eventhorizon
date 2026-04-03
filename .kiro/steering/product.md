# Product Overview

Gravity is a privacy-enhanced prediction market platform built on Stellar blockchain. Users trade on binary (YES/NO) outcomes of real-world events with ZK-proof sealed positions.

## Core Concept

Similar to Polymarket but with privacy: bettors place sealed positions using zero-knowledge proofs. The bet side (YES/NO) remains private until market resolution, preventing front-running and position disclosure.

## Key Features

- Binary prediction markets with YES/NO shares
- ZK-sealed betting: positions hidden until resolution
- Automated payouts via ZK autopay system
- Real-time market pricing based on supply/demand
- Leaderboard tracking top performers

## Technical Innovation

Uses two-circuit ZK design:
- Seal circuit: generates commitment when placing bet (private)
- Reveal circuit: proves position ownership at claim time (public verification)

Positions stored as Poseidon hash commitments on-chain. Nullifiers prevent double-claiming.
