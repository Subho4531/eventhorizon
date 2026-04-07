-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Crypto',
ADD COLUMN     "oracleAddress" TEXT;

-- CreateIndex
CREATE INDEX "Bet_userPublicKey_marketId_createdAt_idx" ON "Bet"("userPublicKey", "marketId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_marketId_createdAt_idx" ON "Bet"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletRelationship_sourceWallet_relationship_idx" ON "WalletRelationship"("sourceWallet", "relationship");

-- CreateIndex
CREATE INDEX "WalletRelationship_targetWallet_relationship_idx" ON "WalletRelationship"("targetWallet", "relationship");
