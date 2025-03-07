/*
  Warnings:

  - Added the required column `billing` to the `subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "subscription" ADD COLUMN     "billing" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "price" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
