-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'CLOSED', 'RESOLVED', 'DISPUTED');

-- CreateTable
CREATE TABLE "User" (
    "publicKey" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "pfpUrl" TEXT NOT NULL DEFAULT '',
    "links" JSONB NOT NULL DEFAULT '[]',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reputationScore" INTEGER NOT NULL DEFAULT 500,
    "reputationTier" TEXT NOT NULL DEFAULT 'Intermediate',
    "oracleReliability" DOUBLE PRECISION,
    "totalResolutions" INTEGER NOT NULL DEFAULT 0,
    "disputedResolutions" INTEGER NOT NULL DEFAULT 0,
    "avgResolutionTime" DOUBLE PRECISION,

    CONSTRAINT "User_pkey" PRIMARY KEY ("publicKey")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userPublicKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "hash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "creatorId" TEXT NOT NULL,
    "openDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closeDate" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "yesPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "noPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contractMarketId" INTEGER,
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "bondAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION,
    "manipulationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minBetSize" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "incentiveMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "userPublicKey" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "commitment" TEXT NOT NULL,
    "nullifier" TEXT,
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "txHash" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProbabilityHistory" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProbabilityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeChallenge" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "proposedOutcome" TEXT NOT NULL,
    "bond" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "votingEndsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeVote" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "stake" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManipulationAlert" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManipulationAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "reward" DOUBLE PRECISION,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidityReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRelationship" (
    "id" TEXT NOT NULL,
    "sourceWallet" TEXT NOT NULL,
    "targetWallet" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_reputationScore_idx" ON "User"("reputationScore");

-- CreateIndex
CREATE UNIQUE INDEX "Market_contractMarketId_key" ON "Market"("contractMarketId");

-- CreateIndex
CREATE INDEX "Market_creatorId_idx" ON "Market"("creatorId");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Bet_commitment_key" ON "Bet"("commitment");

-- CreateIndex
CREATE UNIQUE INDEX "Bet_nullifier_key" ON "Bet"("nullifier");

-- CreateIndex
CREATE INDEX "Bet_marketId_idx" ON "Bet"("marketId");

-- CreateIndex
CREATE INDEX "Bet_userPublicKey_idx" ON "Bet"("userPublicKey");

-- CreateIndex
CREATE INDEX "Bet_commitment_idx" ON "Bet"("commitment");

-- CreateIndex
CREATE INDEX "ProbabilityHistory_marketId_createdAt_idx" ON "ProbabilityHistory"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "DisputeChallenge_marketId_idx" ON "DisputeChallenge"("marketId");

-- CreateIndex
CREATE INDEX "DisputeChallenge_status_idx" ON "DisputeChallenge"("status");

-- CreateIndex
CREATE INDEX "DisputeVote_disputeId_idx" ON "DisputeVote"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeVote_disputeId_voterId_key" ON "DisputeVote"("disputeId", "voterId");

-- CreateIndex
CREATE INDEX "ManipulationAlert_marketId_idx" ON "ManipulationAlert"("marketId");

-- CreateIndex
CREATE INDEX "ManipulationAlert_severity_resolved_idx" ON "ManipulationAlert"("severity", "resolved");

-- CreateIndex
CREATE INDEX "LiquidityReward_userId_weekStart_idx" ON "LiquidityReward"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "WalletRelationship_sourceWallet_idx" ON "WalletRelationship"("sourceWallet");

-- CreateIndex
CREATE INDEX "WalletRelationship_targetWallet_idx" ON "WalletRelationship"("targetWallet");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRelationship_sourceWallet_targetWallet_relationship_key" ON "WalletRelationship"("sourceWallet", "targetWallet", "relationship");

-- CreateIndex
CREATE INDEX "SystemAlert_severity_resolved_idx" ON "SystemAlert"("severity", "resolved");

-- CreateIndex
CREATE INDEX "SystemAlert_createdAt_idx" ON "SystemAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userPublicKey_fkey" FOREIGN KEY ("userPublicKey") REFERENCES "User"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userPublicKey_fkey" FOREIGN KEY ("userPublicKey") REFERENCES "User"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProbabilityHistory" ADD CONSTRAINT "ProbabilityHistory_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeChallenge" ADD CONSTRAINT "DisputeChallenge_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeChallenge" ADD CONSTRAINT "DisputeChallenge_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeVote" ADD CONSTRAINT "DisputeVote_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "DisputeChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeVote" ADD CONSTRAINT "DisputeVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManipulationAlert" ADD CONSTRAINT "ManipulationAlert_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityReward" ADD CONSTRAINT "LiquidityReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("publicKey") ON DELETE RESTRICT ON UPDATE CASCADE;
