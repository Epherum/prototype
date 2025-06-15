/*
  Warnings:

  - You are about to drop the column `restricted_top_level_journal_id` on the `user_roles` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_restricted_top_level_journal_id_fkey";

-- AlterTable
ALTER TABLE "user_roles" DROP COLUMN "restricted_top_level_journal_id";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "restricted_top_level_journal_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_restricted_top_level_journal_id_fkey" FOREIGN KEY ("restricted_top_level_journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
