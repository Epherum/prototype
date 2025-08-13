/*
  Warnings:

  - The `partnership_type` column on the `journal_partner_links` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `good_id` to the `document_lines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `journal_id` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PartnershipType" AS ENUM ('STANDARD_TRANSACTION', 'CONSIGNMENT', 'EXCLUSIVE_SUPPLIER');

-- AlterTable
ALTER TABLE "document_lines" ADD COLUMN     "good_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "journal_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "journal_partner_links" DROP COLUMN "partnership_type",
ADD COLUMN     "partnership_type" "PartnershipType";

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "documents_date_idx" ON "documents"("date");

-- CreateIndex
CREATE INDEX "goods_and_services_label_idx" ON "goods_and_services"("label");

-- CreateIndex
CREATE INDEX "goods_and_services_reference_code_idx" ON "goods_and_services"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_partner_type" ON "journal_partner_links"("journal_id", "partner_id", "partnership_type");

-- CreateIndex
CREATE INDEX "partners_name_idx" ON "partners"("name");

-- CreateIndex
CREATE INDEX "partners_tax_id_idx" ON "partners"("tax_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_good_id_fkey" FOREIGN KEY ("good_id") REFERENCES "goods_and_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
