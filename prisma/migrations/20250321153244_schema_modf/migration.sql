/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `session` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `task_assignment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `task_resource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `twoFactor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `verification` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "account_id_key" ON "account"("id");

-- CreateIndex
CREATE UNIQUE INDEX "session_id_key" ON "session"("id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_id_key" ON "subscription"("id");

-- CreateIndex
CREATE UNIQUE INDEX "task_id_key" ON "task"("id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignment_id_key" ON "task_assignment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "task_resource_id_key" ON "task_resource"("id");

-- CreateIndex
CREATE UNIQUE INDEX "twoFactor_id_key" ON "twoFactor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "user_id_key" ON "user"("id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_id_key" ON "verification"("id");
