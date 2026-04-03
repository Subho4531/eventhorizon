# Implementation Plan: Advanced Prediction Market Intelligence

## Overview

This plan implements AI-based market intelligence, manipulation detection, reputation scoring, and decentralized dispute resolution for the Gravity prediction market platform. The implementation consolidates related functionality into substantial tasks, minimizes testing overhead, and leverages existing codebase patterns.

**Implementation Language**: TypeScript (Next.js 16, React 19)

**Key Constraints**:
- Consolidate related components into single tasks
- Focus on core functionality, minimal testing
- Leverage existing patterns from lib/escrow.ts and prisma/schema.prisma
- Use Stellar SDK patterns already in use
- Each task delivers complete feature area

## Tasks

- [x] 1. Database schema extensions and migrations
  - Extend User model with reputation fields (reputationScore, reputationTier, oracleReliability, totalResolutions, disputedResolutions, avgResolutionTime)
  - Extend Market model with intelligence fields (qualityScore, manipulationScore, minBetSize, incentiveMultiplier, volatility)
  - Create new tables: ProbabilityHistory, DisputeChallenge, DisputeVote, ManipulationAlert, LiquidityReward, WalletRelationship, SystemAlert
  - Add database indexes on frequently queried fields (marketId, userPublicKey, timestamp, reputationScore, status)
  - Create and run Prisma migration
  - Generate Prisma client
  - _Requirements: 16.3, 16.4, 16.5_

- [x] 2. Probability Model + Historical Analysis service
  - Implement lib/intelligence/probability-model.ts with generateInitialProbability, updateProbability, getProbabilityHistory, calculateAccuracy
  - Implement volume-weighted probability calculation using pool size data
  - Implement historical data analysis with exponential decay weighting (0.95^days_ago)
  - Store probability history with timestamps in ProbabilityHistory table
  - Implement fallback to volume-weighted calculation when external data unavailable
  - Create API routes: GET /api/markets/[id]/probability, GET /api/analytics/accuracy
  - Implement in-memory caching with 60-second TTL for probability estimates
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [-] 2.1 Write property tests for probability model
  - **Property 1: Probability Estimate Bounds** - probabilities always between 0.00 and 1.00
  - **Property 3: Probability Fallback Behavior** - falls back to volume-weighted when external unavailable
  - **Property 4: Historical Data Retention** - 90-day history retrievable
  - **Property 5: Exponential Decay Weighting** - weights follow 0.95^days_ago
  - **Validates: Requirements 1.4, 1.7, 2.3, 2.5**

- [ ] 3. Liquidity Manager + Incentive System service
  - Implement lib/intelligence/liquidity-manager.ts with calculateMinBetSize, getIncentiveMultiplier, adjustBondRequirement, distributeLiquidityRewards, getLiquidityParams
  - Implement volume-based bet size adjustment (>1000 XLM/hour → +10%, <100 XLM/24h → -10%, bounds 1-100 XLM)
  - Implement low-liquidity incentive multiplier (pool <500 XLM → 1.05×)
  - Implement weekly liquidity reward distribution (1000 XLM pool, points = bet_amount/10, proportional distribution)
  - Implement volatility-based bond adjustment (>0.20/hour → +20%)
  - Create API routes: GET /api/markets/[id]/liquidity, GET /api/liquidity/incentives
  - Create LiquidityReward records for user tracking
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ]* 3.1 Write property tests for liquidity manager
  - **Property 6: Liquidity Parameter Bounds** - min bet size always 1-100 XLM
  - **Property 7: Volume-Based Bet Size Adjustment** - adjusts correctly based on volume thresholds
  - **Property 8: Low-Liquidity Incentive** - 1.05× multiplier when pool <500 XLM
  - **Property 30: Low-Liquidity Classification** - markets <200 XLM classified correctly
  - **Property 31: Liquidity Reward Points Calculation** - points = bet_amount/10
  - **Property 32: Weekly Reward Distribution** - 1000 XLM distributed proportionally, points reset
  - **Validates: Requirements 3.3, 3.1, 3.2, 3.4, 12.1, 12.4, 12.5, 12.6**

- [ ] 4. Reputation System + Oracle Tracking service
  - Implement lib/intelligence/reputation-system.ts with initializeUser, updateOnBetResult, updateOnMarketResolution, calculateOracleReliability, getReputationTier, getUserReputation
  - Implement reputation score adjustments (new user: 500, win: +5, lose: -2, market resolved: +20, disputed: -100, bounds: [0, 1000])
  - Implement reputation tier assignment (Novice: 0-299, Intermediate: 300-599, Expert: 600-799, Master: 800-1000)
  - Implement oracle reliability calculation ((1 - disputes/total), min 0.00)
  - Implement oracle flagging (reliability <0.80, avg resolution time >72h)
  - Calculate 30-day rolling average reputation scores
  - Create API routes: GET /api/users/[publicKey]/reputation, GET /api/oracles/[address]/reliability
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ]* 4.1 Write property tests for reputation system
  - **Property 9: Reputation Score Bounds** - scores always 0-1000
  - **Property 10: Reputation Updates** - win +5, lose -2, capped/floored correctly
  - **Property 11: Reputation Tier Assignment** - tiers assigned correctly for score ranges
  - **Property 12: Oracle Reliability Calculation** - (1 - disputes/total), min 0.00
  - **Property 13: Oracle Flagging Threshold** - flags when reliability <0.80
  - **Validates: Requirements 4.6, 4.2, 4.3, 4.8, 5.3, 5.4**

- [ ] 5. Manipulation Detection service (all patterns)
  - Implement lib/intelligence/manipulation-detector.ts with analyzeBet, calculateRiskScore, detectWashTrading, detectSybilAccounts, getMarketRisk
  - Implement rapid betting detection (>10 bets/60s from same user)
  - Implement volume spike detection (>500% increase/1h)
  - Implement wash trading detection (opposite-side bets within 600s)
  - Implement Sybil detection (same funding source + same market bets within 24h)
  - Implement risk scoring (base 0, rapid +10, volume spike +20, wash +30, sybil +40, alert threshold 70, auto-extend 85)
  - Create WalletRelationship graph for pattern analysis
  - Create ManipulationAlert records with severity levels
  - Create API route: GET /api/markets/[id]/risk
  - Implement real-time bet monitoring with max 10s latency
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ]* 5.1 Write property tests for manipulation detection
  - **Property 14: Manipulation Risk Score Bounds** - scores always 0-100
  - **Property 15: Rapid Betting Detection** - flags >10 bets/60s
  - **Property 16: Volume Spike Detection** - flags >500% increase/1h
  - **Property 17: Wash Trading Detection** - flags opposite bets within 600s
  - **Property 18: Sybil Risk Score Adjustment** - +30 points for same-source funded accounts
  - **Property 34: Privacy-Preserving Aggregation** - uses only commitments/nullifiers/pool changes
  - **Validates: Requirements 6.4, 6.2, 6.3, 7.2, 7.4, 15.1, 15.2, 15.3, 15.5, 15.7**

- [ ] 6. Dispute Resolution service (challenge + voting + evidence)
  - Implement lib/intelligence/dispute-resolution.ts with submitChallenge, submitVote, finalizeDispute, getDisputeStatus
  - Implement challenge submission (48h period, 100 XLM bond, evidence max 1000 chars + 3 URLs, extends period 24h)
  - Implement duplicate challenge prevention (one per user per market)
  - Implement voting mechanism (reputation >300, min 10 XLM stake, weight = reputation/1000, one vote per dispute)
  - Implement dispute resolution (>50% weighted votes → overturn, accepted: bond + 50 XLM reward, rejected: distribute bond to opposing voters)
  - Implement evidence URL validation (HTTP 200 check, mark unavailable if not)
  - Implement evidence hiding (>10 misleading flags)
  - Implement oracle bond slashing on accepted challenges
  - Create API routes: POST /api/disputes/challenge, POST /api/disputes/[id]/vote, GET /api/markets/[id]/disputes, GET /api/disputes/[id]/evidence
  - Use Prisma transactions for atomic operations
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ]* 6.1 Write property tests for dispute resolution
  - **Property 19: Challenge Period Opening** - 48h period opens on RESOLVED status
  - **Property 20: Challenge Bond Requirement** - exactly 100 XLM required
  - **Property 21: Challenge Evidence Constraints** - max 1000 chars, max 3 URLs
  - **Property 22: Duplicate Challenge Prevention** - one challenge per user per market
  - **Property 23: Voting Eligibility** - reputation >300 required
  - **Property 24: Vote Weighting** - weight = reputation/1000
  - **Property 25: Dispute Resolution Threshold** - >50% weighted votes overturns
  - **Property 26: Challenge Reward Distribution** - bond + 50 XLM for accepted, proportional distribution for rejected
  - **Property 27: Evidence URL Validation** - HTTP 200 check, mark unavailable
  - **Property 28: Evidence Hiding Threshold** - hide after >10 flags
  - **Validates: Requirements 8.1, 8.2, 8.3, 8.7, 9.2, 9.3, 9.6, 9.7, 9.8, 10.2, 10.3, 10.5**

- [ ] 7. Market Quality Scoring + Analytics Dashboard
  - Implement lib/intelligence/quality-scorer.ts with calculateQualityScore, getQualityBreakdown
  - Implement quality score calculation ((creatorReputation/1000 × 30) + (oracleReliability × 30) + (min(liquidityPool/1000, 1) × 20) + (clarityScore × 20))
  - Implement clarity score (min((titleLength + descLength)/200, 1))
  - Update quality scores every 3600 seconds for active markets
  - Implement analytics dashboard with metrics (active markets, total liquidity, 24h volume, high-risk markets, pending disputes, oracle metrics)
  - Implement alert system (manipulation >80, oracle delay >24h, platform liquidity <5000 XLM)
  - Create SystemAlert records with severity levels (INFO, WARNING, CRITICAL)
  - Create API routes: GET /api/markets/[id]/quality, GET /api/analytics/dashboard, GET /api/alerts
  - Implement in-memory caching with 60-second TTL for quality scores
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

- [ ]* 7.1 Write property tests for quality scoring
  - **Property 29: Quality Score Calculation** - formula produces 0-100 value
  - **Property 33: Alert Threshold Triggering** - alerts for risk >70, oracle delay >24h, liquidity <5000 XLM
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 6.6, 14.2, 14.4, 14.5**

- [ ] 8. Background Jobs + Caching infrastructure
  - Implement lib/jobs/probability-updater.ts (30s interval, updates markets closing within 24h every cycle, others every 60s)
  - Implement lib/jobs/liquidity-adjuster.ts (300s interval, recalculates all liquidity parameters)
  - Implement lib/jobs/quality-updater.ts (3600s interval, updates quality scores)
  - Implement lib/jobs/manipulation-monitor.ts (real-time bet event listener)
  - Implement lib/cache/intelligence-cache.ts (in-memory Map with TTL, cache keys for probability/quality/risk/reputation/oracle)
  - Implement cache invalidation on market resolution, bet placement, reputation update, dispute resolution
  - Start background jobs on server startup
  - Implement error handling with exponential backoff for transient failures
  - Implement batch processing for concurrent market updates (batches of 20 for probability, 50 for liquidity, 100 for quality)
  - _Requirements: 1.2, 1.5, 3.6, 11.6, 13.2, 14.1, 17.1, 17.2, 17.3, 17.5, 17.6_

- [ ]* 8.1 Write property tests for performance and privacy
  - **Property 2: Probability Update Frequency** - updates every 60s (>24h away) or 30s (within 24h)
  - **Property 35: Differential Privacy Guarantee** - epsilon = 1.0 for user-level stats
  - **Property 36: Performance Bounds** - 100 markets in 10s, bet analysis in 5s, reputation update in 2s
  - **Validates: Requirements 1.2, 1.5, 15.4, 17.1, 17.2, 17.3**

- [ ] 9. API Routes + Frontend Integration
  - Enhance components/MarketsGrid.tsx with quality score badge, risk indicator, AI probability display
  - Create components/DisputeModal.tsx for challenge submission form
  - Create components/VoteModal.tsx for dispute voting interface
  - Create components/ReputationBadge.tsx for user reputation display with tier colors
  - Create components/QualityIndicator.tsx for market quality visualization
  - Create components/RiskAlert.tsx for manipulation warning banner
  - Create components/IntelligenceDashboard.tsx for admin analytics view
  - Implement rate limiting middleware (100 req/min per user) for all intelligence API endpoints
  - Add loading states and error handling to all new components
  - Integrate intelligence data fetching into existing market display flows
  - Update app/(dashboard)/admin/page.tsx with intelligence metrics
  - _Requirements: 1.8, 2.7, 3.8, 4.10, 5.8, 6.8, 8.8, 9.10, 10.7, 11.7, 11.8, 11.9, 12.7, 13.8, 14.8, 17.8_

- [ ]* 9.1 Write property test for rate limiting
  - **Property 37: Rate Limiting** - 100 requests per minute per user enforced
  - **Validates: Requirements 17.8**

- [ ] 10. Final integration checkpoint
  - Run all property tests and verify they pass
  - Test end-to-end flows: market creation → probability estimate → bet placement → manipulation detection → resolution → challenge → voting → dispute resolution
  - Verify database migrations applied correctly
  - Verify background jobs running without errors
  - Verify cache invalidation working correctly
  - Verify API endpoints returning correct data formats
  - Verify frontend components displaying intelligence data
  - Test with multiple concurrent users
  - Verify privacy guarantees maintained (no bet side access)
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property tests and can be skipped for faster MVP
- Each task consolidates related functionality for substantial work per task
- Property tests validate universal correctness properties across randomized inputs
- Background jobs use simple setInterval (no external dependencies for MVP)
- Caching uses in-memory Map (no Redis required for MVP)
- All intelligence features maintain ZK privacy guarantees (no bet side access)
- Leverage existing patterns from lib/escrow.ts for Stellar SDK integration
- Use Prisma transactions for atomic operations (challenge submission, dispute resolution)
- Rate limiting uses in-memory counter with sliding window
- Database indexes critical for performance at scale
