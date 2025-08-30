/*
  Warnings:

  - Added the required column `creation_journal_level` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creation_journal_level` to the `goods_and_services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creation_level` to the `journal_good_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creation_level` to the `journal_partner_good_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creation_level` to the `journal_partner_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creation_journal_level` to the `partners` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "approval_history" JSONB,
ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approval_timestamps" TIMESTAMP(3)[],
ADD COLUMN     "approved_by_user_ids" TEXT[],
ADD COLUMN     "creation_journal_level" INTEGER NOT NULL,
ADD COLUMN     "current_pending_level" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "goods_and_services" ADD COLUMN     "approval_history" JSONB,
ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approval_timestamps" TIMESTAMP(3)[],
ADD COLUMN     "approved_by_user_ids" TEXT[],
ADD COLUMN     "creation_journal_level" INTEGER NOT NULL,
ADD COLUMN     "current_pending_level" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "journal_good_links" ADD COLUMN     "approval_metadata" JSONB,
ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "creation_level" INTEGER NOT NULL,
ADD COLUMN     "current_pending_level" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "journal_partner_good_links" ADD COLUMN     "approval_metadata" JSONB,
ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "creation_level" INTEGER NOT NULL,
ADD COLUMN     "current_pending_level" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "journal_partner_links" ADD COLUMN     "approval_metadata" JSONB,
ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "creation_level" INTEGER NOT NULL,
ADD COLUMN     "current_pending_level" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "approval_history" JSONB,
ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approval_timestamps" TIMESTAMP(3)[],
ADD COLUMN     "approved_by_user_ids" TEXT[],
ADD COLUMN     "creation_journal_level" INTEGER NOT NULL,
ADD COLUMN     "current_pending_level" INTEGER NOT NULL DEFAULT 0;
