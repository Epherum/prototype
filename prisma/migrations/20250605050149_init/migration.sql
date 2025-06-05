/*
  Warnings:

  - The primary key for the `journals` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[company_id,journal_id,good_id]` on the table `journal_good_links` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[company_id,journal_id,partner_id,partnership_type]` on the table `journal_partner_links` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code,company_id]` on the table `tax_codes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code,company_id]` on the table `units_of_measure` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `company_id` to the `goods_and_services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `journal_good_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `journal_partner_good_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `journal_partner_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `journals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `partners` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `tax_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `units_of_measure` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "journal_good_links" DROP CONSTRAINT "journal_good_links_journal_id_fkey";

-- DropForeignKey
ALTER TABLE "journal_partner_links" DROP CONSTRAINT "journal_partner_links_journal_id_fkey";

-- DropForeignKey
ALTER TABLE "journals" DROP CONSTRAINT "journals_parent_id_fkey";

-- DropIndex
DROP INDEX "goods_and_services_barcode_key";

-- DropIndex
DROP INDEX "goods_and_services_reference_code_key";

-- DropIndex
DROP INDEX "uq_journal_good";

-- DropIndex
DROP INDEX "uq_journal_partner_type";

-- DropIndex
DROP INDEX "tax_codes_code_key";

-- DropIndex
DROP INDEX "units_of_measure_code_key";

-- AlterTable
ALTER TABLE "goods_and_services" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "journal_good_links" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "journal_partner_good_links" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "journal_partner_links" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "journals" DROP CONSTRAINT "journals_pkey",
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD CONSTRAINT "journals_pkey" PRIMARY KEY ("id", "company_id");

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "tax_codes" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "units_of_measure" ADD COLUMN     "company_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "company_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "company_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "restricted_top_level_journal_id" TEXT,
    "restricted_top_level_journal_company_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_role_name_company" ON "roles"("name", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_permission_action_resource" ON "permissions"("action", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comp_journal_good" ON "journal_good_links"("company_id", "journal_id", "good_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comp_journal_partner_type" ON "journal_partner_links"("company_id", "journal_id", "partner_id", "partnership_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_taxcode_code_company" ON "tax_codes"("code", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_uom_code_company" ON "units_of_measure"("code", "company_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_restricted_top_level_journal_id_restricted_top__fkey" FOREIGN KEY ("restricted_top_level_journal_id", "restricted_top_level_journal_company_id") REFERENCES "journals"("id", "company_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "fk_journal_parent" FOREIGN KEY ("parent_id", "company_id") REFERENCES "journals"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_and_services" ADD CONSTRAINT "goods_and_services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_links" ADD CONSTRAINT "journal_partner_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_links" ADD CONSTRAINT "journal_partner_links_journal_id_company_id_fkey" FOREIGN KEY ("journal_id", "company_id") REFERENCES "journals"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_good_links" ADD CONSTRAINT "journal_good_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_good_links" ADD CONSTRAINT "journal_good_links_journal_id_company_id_fkey" FOREIGN KEY ("journal_id", "company_id") REFERENCES "journals"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_good_links" ADD CONSTRAINT "journal_partner_good_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uq_jp_good_link_good" RENAME TO "uq_jp_link_good";
