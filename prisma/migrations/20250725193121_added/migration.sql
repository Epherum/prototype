/*
  Warnings:

  - Added the required column `price` to the `goods_and_services` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "goods_and_services" ADD COLUMN     "price" DECIMAL(18,4) NOT NULL;
