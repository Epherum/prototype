/*
  Warnings:

  - You are about to drop the column `isActive` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[previous_version_id]` on the table `goods_and_services` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[next_version_id]` on the table `goods_and_services` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[previous_version_id]` on the table `partners` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[next_version_id]` on the table `partners` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[previous_version_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[next_version_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `created_by_id` to the `goods_and_services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by_id` to the `partners` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `tax_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `units_of_measure` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EntityState" AS ENUM ('ACTIVE', 'MODIFIED', 'DELETED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "goods_and_services" ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "created_by_id" TEXT NOT NULL,
ADD COLUMN     "created_by_ip" VARCHAR(45),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "deleted_by_ip" VARCHAR(45),
ADD COLUMN     "entity_state" "EntityState" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "next_version_id" BIGINT,
ADD COLUMN     "previous_version_id" BIGINT;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "created_by_id" TEXT NOT NULL,
ADD COLUMN     "created_by_ip" VARCHAR(45),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "deleted_by_ip" VARCHAR(45),
ADD COLUMN     "entity_state" "EntityState" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "next_version_id" BIGINT,
ADD COLUMN     "previous_version_id" BIGINT;

-- AlterTable
ALTER TABLE "tax_codes" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "units_of_measure" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "isActive",
ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "created_by_ip" VARCHAR(45),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "deleted_by_ip" VARCHAR(45),
ADD COLUMN     "entity_state" "EntityState" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "next_version_id" TEXT,
ADD COLUMN     "previous_version_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "goods_and_services_previous_version_id_key" ON "goods_and_services"("previous_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_and_services_next_version_id_key" ON "goods_and_services"("next_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "partners_previous_version_id_key" ON "partners"("previous_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "partners_next_version_id_key" ON "partners"("next_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_previous_version_id_key" ON "users"("previous_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_next_version_id_key" ON "users"("next_version_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_next_version_id_fkey" FOREIGN KEY ("next_version_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "partners"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_next_version_id_fkey" FOREIGN KEY ("next_version_id") REFERENCES "partners"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "goods_and_services" ADD CONSTRAINT "goods_and_services_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_and_services" ADD CONSTRAINT "goods_and_services_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_and_services" ADD CONSTRAINT "goods_and_services_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "goods_and_services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "goods_and_services" ADD CONSTRAINT "goods_and_services_next_version_id_fkey" FOREIGN KEY ("next_version_id") REFERENCES "goods_and_services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
