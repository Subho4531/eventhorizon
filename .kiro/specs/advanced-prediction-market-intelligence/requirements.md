# Requirements Document

## Introduction

This document specifies requirements for evolving the Gravity prediction market platform from a basic ZK-sealed betting system into an advanced intelligent market platform. The system currently supports ZK-sealed betting with Poseidon commitments, escrow management, and basic market resolution on Stellar's Soroban blockchain. The advanced features will add AI-based probability modeling, dynamic liquidity management, reputation scoring, manipulation detection, and decentralized dispute resolution to create a more robust, fair, and economically secure prediction market.

Unlike traditional platforms like Polymarket that expose all positions publicly, Gravity maintains privacy through zero-knowledge proofs while adding intelligent market design and economic security mechanisms.

## Glossary

- **Market_Intelligence_System**: The collection of AI and analytics components that model probabilities, detect manipulation, and optimize liquidity
- **Probability_Model**: AI-based system that generates market probability estimates using historical data, external signals, and trading patterns
- **Liquidity_Manager**: Component that dynamically adjusts market liquidity parameters based on trading volume and volatility
- **Reputation_System**: Scoring mechanism that tracks user prediction accuracy, market creation quality, and oracle reliability
- **Manipulation_Detector**: Real-time monitoring system that identifies suspicious trading patterns and coordinated betting behavior
- **Dispute_Resolution_System**: Decentralized mechanism for challenging and resolving disputed market outcomes
- **Oracle**: Address authorized to resolve market outcomes
- **Market_Creator**: User who deploys a new prediction market and posts a bond
- **Bettor**: User who places ZK-sealed positions on market outcomes
- **Commitment**: Poseidon hash of (side, nonce, bettor_key) stored on-chain to seal a bet
- **Nullifier**: One-time spend tag derived from Poseidon(commitment, nonce) to prevent double-claiming
- **Escrow_Balance**: User's XLM balance held by the contract for betting and bonds
- **Liquidity_Pool**: Total XLM staked in a market across all sealed positions
- **Market_Outcome**: Final resolution state (YES or NO) determined by the oracle
- **Payout_Multiplier**: Basis points determining winner payout (e.g., 20000 = 2×)
- **Reputation_Score**: Numerical value (0-1000) representing user trustworthiness and prediction accuracy
- **Manipulation_Score**: Risk metric (0-100) indicating likelihood of coordinated manipulation
- **Dispute_Bond**: XLM amount required to challenge a market resolution
- **Challenge_Period**: Time window (48 hours) during which market outcomes can be disputed

## Requirements

### Requirement 1: AI-Based Probability Modeling

**User Story:** As a bettor, I want to see AI-generated probability estimates for market outcomes, so that I can make more informed betting decisions based on data-driven insights.

#### Acceptance Criteria

1. WHEN a market is created, THE Probability_Model SHALL generate an initial probability estimate within 5 seconds
2. THE Probability_Model SHALL update probability estimates at least every 60 seconds for active markets
3. THE Probability_Model SHALL incorporate at least three data sources: historical market data, external event signals, and current trading volume
4. THE Probability_Model SHALL output probabilities as decimal values between 0.00 and 1.00 with precision to two decimal places
5. WHEN market close time is within 24 hours, THE Probability_Model SHALL increase update frequency to every 30 seconds
6. THE Probability_Model SHALL store probability history with timestamps for each market in the database
7. IF external data sources are unavailable, THEN THE Probability_Model SHALL fall back to volume-weighted probability calculation
8. THE Probability_Model SHALL expose probability estimates via API endpoint `/api/markets/[id]/probability`

### Requirement 2: Historical Data Analysis

**User Story:** As a market creator, I want the system to analyze historical prediction accuracy, so that probability models improve over time based on past performance.

#### Acceptance Criteria

1. WHEN a market resolves, THE Market_Intelligence_System SHALL record the final outcome and all probability estimates to the historical database
2. THE Market_Intelligence_System SHALL calculate prediction accuracy by comparing final outcomes to probability estimates at market close
3. THE Market_Intelligence_System SHALL maintain at least 90 days of historical market data
4. THE Market_Intelligence_System SHALL compute aggregate accuracy metrics across market categories
5. WHEN generating new probability estimates, THE Probability_Model SHALL weight similar historical markets by recency with exponential decay factor of 0.95 per day
6. THE Market_Intelligence_System SHALL identify and tag markets with anomalous outcomes for model retraining
7. THE Market_Intelligence_System SHALL expose historical accuracy metrics via API endpoint `/api/analytics/accuracy`

### Requirement 3: Dynamic Liquidity Adjustment

**User Story:** As a platform operator, I want liquidity parameters to adjust automatically based on market conditions, so that markets remain stable and efficient without manual intervention.

#### Acceptance Criteria

1. WHEN a market's trading volume exceeds 1000 XLM in 1 hour, THE Liquidity_Manager SHALL increase the minimum bet size by 10 percent
2. WHEN a market's trading volume falls below 100 XLM in 24 hours, THE Liquidity_Manager SHALL decrease the minimum bet size by 10 percent
3. THE Liquidity_Manager SHALL enforce minimum bet size between 1 XLM and 100 XLM
4. WHILE a market's liquidity pool is below 500 XLM, THE Liquidity_Manager SHALL apply a liquidity incentive multiplier of 1.05× to winning payouts
5. WHEN market volatility (measured by probability change rate) exceeds 0.20 per hour, THE Liquidity_Manager SHALL increase the creator bond requirement by 20 percent for new similar markets
6. THE Liquidity_Manager SHALL recalculate liquidity parameters every 300 seconds for all active markets
7. THE Liquidity_Manager SHALL log all parameter adjustments with timestamps and reasons to the audit log
8. THE Liquidity_Manager SHALL expose current liquidity parameters via API endpoint `/api/markets/[id]/liquidity`

### Requirement 4: User Reputation Scoring

**User Story:** As a bettor, I want to see reputation scores for market creators and oracles, so that I can assess the trustworthiness of markets before betting.

#### Acceptance Criteria

1. THE Reputation_System SHALL assign each user an initial reputation score of 500 upon account creation
2. WHEN a user wins a bet, THE Reputation_System SHALL increase their reputation score by 5 points
3. WHEN a user loses a bet, THE Reputation_System SHALL decrease their reputation score by 2 points
4. WHEN a market creator's market resolves without disputes, THE Reputation_System SHALL increase their reputation score by 20 points
5. IF a market resolution is successfully disputed, THEN THE Reputation_System SHALL decrease the oracle's reputation score by 100 points
6. THE Reputation_System SHALL enforce reputation score bounds between 0 and 1000
7. THE Reputation_System SHALL calculate a 30-day rolling average reputation score for display purposes
8. THE Reputation_System SHALL assign reputation tiers: Novice (0-299), Intermediate (300-599), Expert (600-799), Master (800-1000)
9. WHERE a market creator has reputation score below 300, THE Reputation_System SHALL require a bond increase of 50 percent
10. THE Reputation_System SHALL expose user reputation data via API endpoint `/api/users/[publicKey]/reputation`

### Requirement 5: Oracle Reliability Tracking

**User Story:** As a platform operator, I want to track oracle performance and reliability, so that unreliable oracles can be identified and potentially restricted.

#### Acceptance Criteria

1. THE Reputation_System SHALL track the total number of markets resolved by each oracle
2. THE Reputation_System SHALL track the number of disputed resolutions for each oracle
3. THE Reputation_System SHALL calculate oracle reliability as (1 - disputes / total_resolutions) with minimum value of 0.00
4. WHEN an oracle's reliability score falls below 0.80, THE Reputation_System SHALL flag the oracle account for review
5. THE Reputation_System SHALL track average resolution time for each oracle measured from market close to resolution transaction
6. WHEN an oracle's average resolution time exceeds 72 hours, THE Reputation_System SHALL apply a 10-point reputation penalty
7. THE Reputation_System SHALL maintain oracle performance history for at least 180 days
8. THE Reputation_System SHALL expose oracle reliability metrics via API endpoint `/api/oracles/[address]/reliability`

### Requirement 6: Manipulation Detection - Pattern Analysis

**User Story:** As a platform operator, I want to detect suspicious betting patterns, so that market manipulation attempts can be identified and investigated.

#### Acceptance Criteria

1. THE Manipulation_Detector SHALL monitor all bet transactions in real-time with maximum latency of 10 seconds
2. WHEN a single user places more than 10 bets on the same market within 60 seconds, THE Manipulation_Detector SHALL flag the activity as suspicious
3. WHEN total bet volume on a market increases by more than 500 percent within 1 hour, THE Manipulation_Detector SHALL generate a volatility alert
4. THE Manipulation_Detector SHALL calculate a manipulation risk score (0-100) for each market based on betting patterns
5. THE Manipulation_Detector SHALL identify coordinated betting by detecting multiple users betting similar amounts within 300 seconds
6. WHEN manipulation risk score exceeds 70, THE Manipulation_Detector SHALL notify platform administrators via the alert system
7. THE Manipulation_Detector SHALL log all flagged activities with timestamps, user addresses, and risk scores to the audit database
8. THE Manipulation_Detector SHALL expose manipulation risk data via API endpoint `/api/markets/[id]/risk`

### Requirement 7: Manipulation Detection - Wash Trading

**User Story:** As a platform operator, I want to detect wash trading and self-dealing, so that artificial volume inflation can be prevented.

#### Acceptance Criteria

1. THE Manipulation_Detector SHALL track betting patterns across user accounts
2. WHEN two or more users consistently bet on opposite sides of the same markets within 600 seconds, THE Manipulation_Detector SHALL flag potential wash trading
3. THE Manipulation_Detector SHALL analyze wallet funding sources to identify potential Sybil accounts
4. WHEN multiple accounts are funded from the same source wallet within 24 hours and subsequently bet on the same market, THE Manipulation_Detector SHALL increase the manipulation risk score by 30 points
5. THE Manipulation_Detector SHALL maintain a graph database of wallet relationships for pattern analysis
6. THE Manipulation_Detector SHALL apply machine learning clustering algorithms to identify coordinated account groups
7. IF wash trading is detected with confidence above 0.85, THEN THE Manipulation_Detector SHALL automatically extend the dispute period by 24 hours

### Requirement 8: Decentralized Dispute Resolution - Challenge Mechanism

**User Story:** As a bettor, I want to challenge incorrect market resolutions, so that I can protect my winnings when oracles make mistakes.

#### Acceptance Criteria

1. WHEN a market is resolved, THE Dispute_Resolution_System SHALL open a 48-hour challenge period
2. THE Dispute_Resolution_System SHALL require a dispute bond of 100 XLM to submit a challenge
3. WHEN a user submits a challenge, THE Dispute_Resolution_System SHALL accept evidence as text description (maximum 1000 characters) and up to 3 external URL references
4. THE Dispute_Resolution_System SHALL record the challenger's address, challenge timestamp, evidence, and proposed alternative outcome
5. THE Dispute_Resolution_System SHALL extend the challenge period by 24 hours when a challenge is submitted
6. THE Dispute_Resolution_System SHALL allow multiple challenges on the same market resolution
7. THE Dispute_Resolution_System SHALL prevent the same user from submitting more than one challenge per market
8. THE Dispute_Resolution_System SHALL store all challenges in the database with status tracking (PENDING, ACCEPTED, REJECTED)

### Requirement 9: Decentralized Dispute Resolution - Voting Mechanism

**User Story:** As a platform participant, I want to vote on disputed resolutions, so that the community can collectively determine correct outcomes.

#### Acceptance Criteria

1. WHEN a challenge is submitted, THE Dispute_Resolution_System SHALL open a 72-hour voting period
2. WHERE a user has reputation score above 300, THE Dispute_Resolution_System SHALL allow the user to cast one vote per dispute
3. THE Dispute_Resolution_System SHALL weight votes by the voter's reputation score divided by 1000
4. THE Dispute_Resolution_System SHALL require voters to stake at least 10 XLM to participate in voting
5. WHEN the voting period ends, THE Dispute_Resolution_System SHALL calculate the weighted vote total for each outcome option
6. IF the challenge receives more than 50 percent of weighted votes, THEN THE Dispute_Resolution_System SHALL overturn the original resolution
7. WHEN a challenge is accepted, THE Dispute_Resolution_System SHALL return the challenger's dispute bond plus a 50 XLM reward
8. WHEN a challenge is rejected, THE Dispute_Resolution_System SHALL distribute the dispute bond proportionally to voters who voted against the challenge
9. THE Dispute_Resolution_System SHALL slash the oracle's bond when a challenge is accepted
10. THE Dispute_Resolution_System SHALL expose dispute status via API endpoint `/api/markets/[id]/disputes`

### Requirement 10: Decentralized Dispute Resolution - Evidence Verification

**User Story:** As a voter in a dispute, I want to review submitted evidence, so that I can make an informed voting decision.

#### Acceptance Criteria

1. THE Dispute_Resolution_System SHALL display all submitted evidence for each challenge in chronological order
2. THE Dispute_Resolution_System SHALL validate that evidence URLs are accessible and return HTTP status 200
3. WHEN an evidence URL is inaccessible, THE Dispute_Resolution_System SHALL mark it as unavailable with a warning indicator
4. THE Dispute_Resolution_System SHALL allow voters to flag evidence as misleading or irrelevant
5. WHEN evidence receives more than 10 misleading flags, THE Dispute_Resolution_System SHALL hide the evidence with a warning message
6. THE Dispute_Resolution_System SHALL provide a summary view showing original resolution, challenge claim, and vote distribution
7. THE Dispute_Resolution_System SHALL expose evidence data via API endpoint `/api/disputes/[id]/evidence`

### Requirement 11: Market Quality Scoring

**User Story:** As a bettor, I want to see quality scores for markets, so that I can prioritize well-designed markets with reliable oracles.

#### Acceptance Criteria

1. THE Market_Intelligence_System SHALL calculate a market quality score (0-100) for each market
2. THE Market_Intelligence_System SHALL incorporate creator reputation score (weighted 30 percent) into quality calculation
3. THE Market_Intelligence_System SHALL incorporate oracle reliability score (weighted 30 percent) into quality calculation
4. THE Market_Intelligence_System SHALL incorporate liquidity depth (weighted 20 percent) into quality calculation
5. THE Market_Intelligence_System SHALL incorporate market clarity score based on title and description length (weighted 20 percent) into quality calculation
6. THE Market_Intelligence_System SHALL update quality scores every 3600 seconds for active markets
7. THE Market_Intelligence_System SHALL display quality scores on market cards in the frontend
8. WHERE a market has quality score below 40, THE Market_Intelligence_System SHALL display a warning indicator to users
9. THE Market_Intelligence_System SHALL expose quality scores via API endpoint `/api/markets/[id]/quality`

### Requirement 12: Liquidity Incentive Programs

**User Story:** As a platform operator, I want to incentivize liquidity provision in low-volume markets, so that all markets maintain healthy trading activity.

#### Acceptance Criteria

1. THE Liquidity_Manager SHALL identify markets with total volume below 200 XLM as low-liquidity markets
2. WHERE a market is classified as low-liquidity, THE Liquidity_Manager SHALL apply a 1.10× payout multiplier to winning bets
3. THE Liquidity_Manager SHALL allocate a platform liquidity incentive pool of 1000 XLM per week
4. WHEN a user bets on a low-liquidity market, THE Liquidity_Manager SHALL credit the user with liquidity reward points equal to bet amount divided by 10
5. WHEN the weekly incentive period ends, THE Liquidity_Manager SHALL distribute the incentive pool proportionally to users based on accumulated reward points
6. THE Liquidity_Manager SHALL reset liquidity reward points to zero at the start of each weekly period
7. THE Liquidity_Manager SHALL expose liquidity incentive status via API endpoint `/api/liquidity/incentives`

### Requirement 13: Real-Time Market Analytics Dashboard

**User Story:** As a platform operator, I want a real-time analytics dashboard, so that I can monitor platform health and identify issues quickly.

#### Acceptance Criteria

1. THE Market_Intelligence_System SHALL provide a dashboard displaying total active markets, total locked liquidity, and 24-hour trading volume
2. THE Market_Intelligence_System SHALL update dashboard metrics every 30 seconds
3. THE Market_Intelligence_System SHALL display a list of markets with manipulation risk score above 60
4. THE Market_Intelligence_System SHALL display a list of pending disputes with vote counts
5. THE Market_Intelligence_System SHALL display oracle performance metrics including average resolution time and reliability scores
6. THE Market_Intelligence_System SHALL display platform-wide reputation score distribution as a histogram
7. THE Market_Intelligence_System SHALL provide time-series charts for trading volume, new users, and market creation rate over the past 30 days
8. THE Market_Intelligence_System SHALL expose dashboard data via API endpoint `/api/analytics/dashboard`

### Requirement 14: Automated Market Monitoring

**User Story:** As a platform operator, I want automated monitoring and alerting, so that critical issues are detected and escalated without manual oversight.

#### Acceptance Criteria

1. THE Market_Intelligence_System SHALL monitor all active markets for anomalies every 60 seconds
2. WHEN a market's manipulation risk score exceeds 80, THE Market_Intelligence_System SHALL send an alert notification to platform administrators
3. WHEN a dispute voting period is ending within 6 hours and vote participation is below 10 voters, THE Market_Intelligence_System SHALL send a participation reminder notification
4. WHEN an oracle fails to resolve a market within 24 hours of close time, THE Market_Intelligence_System SHALL send a delayed resolution alert
5. WHEN platform total liquidity drops below 5000 XLM, THE Market_Intelligence_System SHALL send a liquidity warning alert
6. THE Market_Intelligence_System SHALL log all alerts with timestamps and severity levels (INFO, WARNING, CRITICAL) to the alert database
7. THE Market_Intelligence_System SHALL provide an alert subscription system via webhook URLs for external monitoring tools
8. THE Market_Intelligence_System SHALL expose alert history via API endpoint `/api/alerts`

### Requirement 15: Privacy-Preserving Analytics

**User Story:** As a bettor, I want my betting positions to remain private while still contributing to market analytics, so that I maintain ZK privacy guarantees.

#### Acceptance Criteria

1. THE Market_Intelligence_System SHALL compute aggregate statistics without accessing individual bet sides
2. THE Market_Intelligence_System SHALL derive trading volume from total pool changes rather than individual bet amounts
3. THE Market_Intelligence_System SHALL use only commitment hashes and nullifiers for manipulation detection, not bet sides
4. THE Market_Intelligence_System SHALL implement differential privacy with epsilon value of 1.0 for user-level statistics
5. WHEN generating probability estimates, THE Probability_Model SHALL use only aggregate pool data and external signals, not individual sealed positions
6. THE Market_Intelligence_System SHALL document all data access patterns in a privacy audit log
7. THE Market_Intelligence_System SHALL never store or transmit bet sides outside of the user's local browser and the ZK proof verification process

### Requirement 16: Integration with Existing ZK Architecture

**User Story:** As a developer, I want the intelligence features to integrate seamlessly with the existing ZK-sealed betting system, so that privacy guarantees are maintained.

#### Acceptance Criteria

1. THE Market_Intelligence_System SHALL read market data from the existing Soroban contract via RPC calls
2. THE Market_Intelligence_System SHALL read bet commitments from the existing Prisma database schema
3. THE Market_Intelligence_System SHALL extend the existing Market model with new fields: qualityScore, manipulationScore, liquidityParams
4. THE Market_Intelligence_System SHALL extend the existing User model with new fields: reputationScore, reputationTier, oracleReliability
5. THE Market_Intelligence_System SHALL create new database tables: ProbabilityHistory, DisputeChallenge, DisputeVote, ManipulationAlert, LiquidityIncentive
6. THE Market_Intelligence_System SHALL expose all new functionality via REST API endpoints under `/api/intelligence/`
7. THE Market_Intelligence_System SHALL maintain backward compatibility with existing frontend components
8. THE Market_Intelligence_System SHALL not modify the existing seal_bet and reveal_bet Circom circuits

### Requirement 17: Performance and Scalability

**User Story:** As a platform operator, I want the intelligence system to scale efficiently, so that performance remains acceptable as the platform grows.

#### Acceptance Criteria

1. THE Market_Intelligence_System SHALL process probability updates for 100 active markets within 10 seconds
2. THE Manipulation_Detector SHALL analyze incoming bet transactions with maximum latency of 5 seconds per transaction
3. THE Reputation_System SHALL update user reputation scores within 2 seconds of bet resolution
4. THE Market_Intelligence_System SHALL use database indexing on frequently queried fields: marketId, userPublicKey, timestamp, reputationScore
5. THE Market_Intelligence_System SHALL implement caching with 60-second TTL for probability estimates and quality scores
6. THE Market_Intelligence_System SHALL use background job processing for computationally intensive tasks such as historical analysis and machine learning model updates
7. THE Market_Intelligence_System SHALL handle at least 1000 concurrent API requests with 95th percentile response time below 500 milliseconds
8. THE Market_Intelligence_System SHALL implement rate limiting of 100 requests per minute per user for all intelligence API endpoints
