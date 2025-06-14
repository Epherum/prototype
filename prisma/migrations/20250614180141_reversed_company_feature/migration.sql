/*
  Warnings:

  - You are about to drop the column `company_id` on the `goods_and_services` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `journal_good_links` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `journal_partner_good_links` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `journal_partner_links` table. All the data in the column will be lost.
  - The primary key for the `journals` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `company_id` on the `journals` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `partners` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `roles` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `tax_codes` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `units_of_measure` table. All the data in the column will be lost.
  - You are about to drop the column `restricted_top_level_journal_company_id` on the `user_roles` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `companies` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[journal_id,good_id]` on the table `journal_good_links` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[journal_id,partner_id,partnership_type]` on the table `journal_partner_links` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `tax_codes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `units_of_measure` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "goods_and_services" DROP CONSTRAINT "goods_and_services_company_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_good_links" DROP CONSTRAINT "journal_good_links_company_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_good_links" DROP CONSTRAINT "journal_good_links_journal_id_company_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_partner_good_links" DROP CONSTRAINT "journal_partner_good_links_company_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_partner_links" DROP CONSTRAINT "journal_partner_links_company_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_partner_links" DROP CONSTRAINT "journal_partner_links_journal_id_company_id_fkey";

-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "fk_journal_parent";

-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_company_id_fkey";

-- DropForeignKey
ALTER TABLE "partners" DROP CONSTRAINT "partners_company_id_fkey";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_company_id_fkey";

-- DropForeignKey
ALTER TABLE "tax_codes" DROP CONSTRAINT "tax_codes_company_id_fkey";

-- DropForeignKey
ALTER TABLE "units_of_measure" DROP CONSTRAINT "units_of_measure_company_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_restricted_top_level_journal_id_restricted_top__fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_company_id_fkey";

-- DropIndex
DROP INDEX "uq_comp_journal_good";

-- DropIndex
DROP INDEX "uq_comp_journal_partner_type";

-- DropIndex
DROP INDEX "uq_role_name_company";

-- DropIndex
DROP INDEX "uq_taxcode_code_company";

-- DropIndex
DROP INDEX "uq_uom_code_company";

-- AlterTable
ALTER TABLE "goods_and_services" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "journal_good_links" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "journal_partner_good_links" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "journal_partner_links" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "journals" DROP CONSTRAINT "journals_pkey",
DROP COLUMN "company_id",
ADD CONSTRAINT "journals_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "partners" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "roles" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "tax_codes" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "units_of_measure" DROP COLUMN "company_id";

-- AlterTable
ALTER TABLE "user_roles" DROP COLUMN "restricted_top_level_journal_company_id";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "company_id";

-- DropTable
DROP TABLE "companies";

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_good" ON "journal_good_links"("journal_id", "good_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_partner_type" ON "journal_partner_links"("journal_id", "partner_id", "partnership_type");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_code_key" ON "tax_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_restricted_top_level_journal_id_fkey" FOREIGN KEY ("restricted_top_level_journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "fk_journal_parent" FOREIGN KEY ("parent_id") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_links" ADD CONSTRAINT "journal_partner_links_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_good_links" ADD CONSTRAINT "journal_good_links_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
