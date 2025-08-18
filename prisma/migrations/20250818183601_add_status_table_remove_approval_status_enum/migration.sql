/*
  Warnings:

  - You are about to drop the column `approval_status` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `approval_status` on the `goods_and_services` table. All the data in the column will be lost.
  - You are about to drop the column `approval_status` on the `partners` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "documents" DROP COLUMN "approval_status",
ADD COLUMN     "status_id" TEXT;

-- AlterTable
ALTER TABLE "goods_and_services" DROP COLUMN "approval_status",
ADD COLUMN     "status_id" TEXT;

-- AlterTable
ALTER TABLE "partners" DROP COLUMN "approval_status",
ADD COLUMN     "status_id" TEXT;

-- CreateTable
CREATE TABLE "statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "statuses_name_key" ON "statuses"("name");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_and_services" ADD CONSTRAINT "goods_and_services_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
