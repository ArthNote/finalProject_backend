/*
  Warnings:

  - You are about to drop the column `teamId` on the `task` table. All the data in the column will be lost.
  - You are about to drop the `team` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `team_activity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `team_member` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `team_resource` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_teamId_fkey";

-- DropForeignKey
ALTER TABLE "team" DROP CONSTRAINT "team_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "team_activity" DROP CONSTRAINT "team_activity_teamId_fkey";

-- DropForeignKey
ALTER TABLE "team_activity" DROP CONSTRAINT "team_activity_userId_fkey";

-- DropForeignKey
ALTER TABLE "team_member" DROP CONSTRAINT "team_member_teamId_fkey";

-- DropForeignKey
ALTER TABLE "team_member" DROP CONSTRAINT "team_member_userId_fkey";

-- DropForeignKey
ALTER TABLE "team_resource" DROP CONSTRAINT "team_resource_createdById_fkey";

-- DropForeignKey
ALTER TABLE "team_resource" DROP CONSTRAINT "team_resource_teamId_fkey";

-- AlterTable
ALTER TABLE "task" DROP COLUMN "teamId";

-- DropTable
DROP TABLE "team";

-- DropTable
DROP TABLE "team_activity";

-- DropTable
DROP TABLE "team_member";

-- DropTable
DROP TABLE "team_resource";
