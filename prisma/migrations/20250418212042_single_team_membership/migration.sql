/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `team_member` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "team_member_userId_teamId_key";

-- CreateIndex
CREATE UNIQUE INDEX "team_member_userId_key" ON "team_member"("userId");
