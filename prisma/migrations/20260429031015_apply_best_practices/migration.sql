/*
  Warnings:

  - You are about to drop the `Bet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DisputeChallenge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DisputeVote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LiquidityReward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ManipulationAlert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Market` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProbabilityHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SystemAlert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletRelationship` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Bet" DROP CONSTRAINT "Bet_marketId_fkey";

-- DropForeignKey
ALTER TABLE "Bet" DROP CONSTRAINT "Bet_userPublicKey_fkey";

-- DropForeignKey
ALTER TABLE "DisputeChallenge" DROP CONSTRAINT "DisputeChallenge_challengerId_fkey";

-- DropForeignKey
ALTER TABLE "DisputeChallenge" DROP CONSTRAINT "DisputeChallenge_marketId_fkey";

-- DropForeignKey
ALTER TABLE "DisputeVote" DROP CONSTRAINT "DisputeVote_disputeId_fkey";

-- DropForeignKey
ALTER TABLE "DisputeVote" DROP CONSTRAINT "DisputeVote_voterId_fkey";

-- DropForeignKey
ALTER TABLE "LiquidityReward" DROP CONSTRAINT "LiquidityReward_userId_fkey";

-- DropForeignKey
ALTER TABLE "ManipulationAlert" DROP CONSTRAINT "ManipulationAlert_marketId_fkey";

-- DropForeignKey
ALTER TABLE "Market" DROP CONSTRAINT "Market_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "ProbabilityHistory" DROP CONSTRAINT "ProbabilityHistory_marketId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userPublicKey_fkey";

-- DropTable
DROP TABLE "Bet";

-- DropTable
DROP TABLE "DisputeChallenge";

-- DropTable
DROP TABLE "DisputeVote";

-- DropTable
DROP TABLE "LiquidityReward";

-- DropTable
DROP TABLE "ManipulationAlert";

-- DropTable
DROP TABLE "Market";

-- DropTable
DROP TABLE "ProbabilityHistory";

-- DropTable
DROP TABLE "SystemAlert";

-- DropTable
DROP TABLE "Transaction";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "WalletRelationship";

-- CreateTable
CREATE TABLE "users" (
    "public_key" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "pfp_url" TEXT NOT NULL DEFAULT '',
    "links" JSONB NOT NULL DEFAULT '[]',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_winnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reputation_score" INTEGER NOT NULL DEFAULT 500,
    "reputation_tier" TEXT NOT NULL DEFAULT 'Intermediate',
    "oracle_reliability" DOUBLE PRECISION,
    "total_resolutions" INTEGER NOT NULL DEFAULT 0,
    "disputed_resolutions" INTEGER NOT NULL DEFAULT 0,
    "avg_resolution_time" DOUBLE PRECISION,

    CONSTRAINT "users_pkey" PRIMARY KEY ("public_key")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_public_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "hash" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "creator_id" TEXT NOT NULL,
    "open_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "close_date" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "yes_pool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "no_pool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contract_market_id" INTEGER,
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "quality_score" DOUBLE PRECISION,
    "manipulation_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "min_bet_size" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "incentive_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Crypto',
    "image_url" TEXT DEFAULT '',
    "oracle_address" TEXT,
    "payout_bps" INTEGER DEFAULT 10000,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "user_public_key" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "commitment" TEXT NOT NULL,
    "nullifier" TEXT,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "tx_hash" TEXT,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "probability_history" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sources" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "probability_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_challenges" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "challenger_id" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "proposed_outcome" TEXT NOT NULL,
    "bond" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "voting_ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_votes" (
    "id" TEXT NOT NULL,
    "dispute_id" TEXT NOT NULL,
    "voter_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "stake" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manipulation_alerts" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manipulation_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidity_rewards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "reward" DOUBLE PRECISION,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidity_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_relationships" (
    "id" TEXT NOT NULL,
    "source_wallet" TEXT NOT NULL,
    "target_wallet" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_reputation_score_idx" ON "users"("reputation_score");

-- CreateIndex
CREATE INDEX "transactions_user_public_key_created_at_idx" ON "transactions"("user_public_key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "markets_contract_market_id_key" ON "markets"("contract_market_id");

-- CreateIndex
CREATE INDEX "markets_creator_id_idx" ON "markets"("creator_id");

-- CreateIndex
CREATE INDEX "markets_status_idx" ON "markets"("status");

-- CreateIndex
CREATE INDEX "markets_created_at_idx" ON "markets"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bets_commitment_key" ON "bets"("commitment");

-- CreateIndex
CREATE UNIQUE INDEX "bets_nullifier_key" ON "bets"("nullifier");

-- CreateIndex
CREATE INDEX "bets_market_id_idx" ON "bets"("market_id");

-- CreateIndex
CREATE INDEX "bets_user_public_key_idx" ON "bets"("user_public_key");

-- CreateIndex
CREATE INDEX "bets_commitment_idx" ON "bets"("commitment");

-- CreateIndex
CREATE INDEX "bets_user_public_key_market_id_created_at_idx" ON "bets"("user_public_key", "market_id", "created_at");

-- CreateIndex
CREATE INDEX "bets_market_id_created_at_idx" ON "bets"("market_id", "created_at");

-- CreateIndex
CREATE INDEX "probability_history_market_id_created_at_idx" ON "probability_history"("market_id", "created_at");

-- CreateIndex
CREATE INDEX "dispute_challenges_market_id_idx" ON "dispute_challenges"("market_id");

-- CreateIndex
CREATE INDEX "dispute_challenges_status_idx" ON "dispute_challenges"("status");

-- CreateIndex
CREATE INDEX "dispute_votes_dispute_id_idx" ON "dispute_votes"("dispute_id");

-- CreateIndex
CREATE INDEX "dispute_votes_voter_id_idx" ON "dispute_votes"("voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_votes_dispute_id_voter_id_key" ON "dispute_votes"("dispute_id", "voter_id");

-- CreateIndex
CREATE INDEX "manipulation_alerts_market_id_resolved_created_at_idx" ON "manipulation_alerts"("market_id", "resolved", "created_at");

-- CreateIndex
CREATE INDEX "manipulation_alerts_severity_resolved_idx" ON "manipulation_alerts"("severity", "resolved");

-- CreateIndex
CREATE INDEX "liquidity_rewards_user_id_week_start_idx" ON "liquidity_rewards"("user_id", "week_start");

-- CreateIndex
CREATE INDEX "wallet_relationships_source_wallet_idx" ON "wallet_relationships"("source_wallet");

-- CreateIndex
CREATE INDEX "wallet_relationships_target_wallet_idx" ON "wallet_relationships"("target_wallet");

-- CreateIndex
CREATE INDEX "wallet_relationships_source_wallet_relationship_idx" ON "wallet_relationships"("source_wallet", "relationship");

-- CreateIndex
CREATE INDEX "wallet_relationships_target_wallet_relationship_idx" ON "wallet_relationships"("target_wallet", "relationship");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_relationships_source_wallet_target_wallet_relationsh_key" ON "wallet_relationships"("source_wallet", "target_wallet", "relationship");

-- CreateIndex
CREATE INDEX "system_alerts_severity_resolved_idx" ON "system_alerts"("severity", "resolved");

-- CreateIndex
CREATE INDEX "system_alerts_created_at_idx" ON "system_alerts"("created_at");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_public_key_fkey" FOREIGN KEY ("user_public_key") REFERENCES "users"("public_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("public_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_public_key_fkey" FOREIGN KEY ("user_public_key") REFERENCES "users"("public_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probability_history" ADD CONSTRAINT "probability_history_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_challenges" ADD CONSTRAINT "dispute_challenges_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "users"("public_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_challenges" ADD CONSTRAINT "dispute_challenges_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_votes" ADD CONSTRAINT "dispute_votes_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "dispute_challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_votes" ADD CONSTRAINT "dispute_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("public_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manipulation_alerts" ADD CONSTRAINT "manipulation_alerts_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidity_rewards" ADD CONSTRAINT "liquidity_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("public_key") ON DELETE RESTRICT ON UPDATE CASCADE;
