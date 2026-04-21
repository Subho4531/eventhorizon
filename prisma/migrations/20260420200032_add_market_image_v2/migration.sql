/*
  Warnings:

  - You are about to drop the column `bondAmount` on the `Market` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Market" DROP COLUMN "bondAmount",
ADD COLUMN     "imageUrl" TEXT DEFAULT '',
ADD COLUMN     "payoutBps" INTEGER DEFAULT 10000;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totalWinnings" DOUBLE PRECISION NOT NULL DEFAULT 0;
