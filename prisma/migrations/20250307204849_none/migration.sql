/*
  Warnings:

  - You are about to drop the column `billing` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `subscription` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_userId_fkey";

-- AlterTable
ALTER TABLE "subscription" DROP COLUMN "billing",
DROP COLUMN "createdAt",
DROP COLUMN "price",
DROP COLUMN "updatedAt",
DROP COLUMN "userId";
