-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('LEGAL_ENTITY', 'NATURAL_PERSON');

-- CreateTable
CREATE TABLE "journals" (
    "id" VARCHAR(100) NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" VARCHAR(100),
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "additional_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" BIGSERIAL NOT NULL,
    "partner_type" "PartnerType" NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "logo_url" VARCHAR(255),
    "photo_url" VARCHAR(255),
    "is_us" BOOLEAN DEFAULT false,
    "registration_number" VARCHAR(100),
    "tax_id" VARCHAR(100),
    "bio_father_name" VARCHAR(100),
    "bio_mother_name" VARCHAR(100),
    "additional_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "rate" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_and_services" (
    "id" BIGSERIAL NOT NULL,
    "reference_code" VARCHAR(50),
    "barcode" VARCHAR(50),
    "tax_code_id" INTEGER,
    "type_code" VARCHAR(25),
    "label" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "unit_code_id" INTEGER,
    "stock_tracking_method" VARCHAR(50),
    "packaging_type_code" VARCHAR(25),
    "photo_url" VARCHAR(255),
    "additional_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_and_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_partner_links" (
    "id" BIGSERIAL NOT NULL,
    "journal_id" VARCHAR(100) NOT NULL,
    "partner_id" BIGINT NOT NULL,
    "partnership_type" VARCHAR(50),
    "exoneration" BOOLEAN DEFAULT false,
    "period_type" VARCHAR(50),
    "date_debut" DATE,
    "date_fin" DATE,
    "document_reference" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_partner_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_good_links" (
    "id" BIGSERIAL NOT NULL,
    "journal_id" VARCHAR(100) NOT NULL,
    "good_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_good_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_partner_good_links" (
    "id" BIGSERIAL NOT NULL,
    "journal_partner_link_id" BIGINT NOT NULL,
    "good_id" BIGINT NOT NULL,
    "descriptive_text" TEXT,
    "contextual_tax_code_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_partner_good_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_code_key" ON "tax_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "goods_and_services_reference_code_key" ON "goods_and_services"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "goods_and_services_barcode_key" ON "goods_and_services"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_partner_type" ON "journal_partner_links"("journal_id", "partner_id", "partnership_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_good" ON "journal_good_links"("journal_id", "good_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_jp_good_link_good" ON "journal_partner_good_links"("journal_partner_link_id", "good_id");

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_and_services" ADD CONSTRAINT "goods_and_services_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_and_services" ADD CONSTRAINT "goods_and_services_unit_code_id_fkey" FOREIGN KEY ("unit_code_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_links" ADD CONSTRAINT "journal_partner_links_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_links" ADD CONSTRAINT "journal_partner_links_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_good_links" ADD CONSTRAINT "journal_good_links_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_good_links" ADD CONSTRAINT "journal_good_links_good_id_fkey" FOREIGN KEY ("good_id") REFERENCES "goods_and_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_good_links" ADD CONSTRAINT "journal_partner_good_links_journal_partner_link_id_fkey" FOREIGN KEY ("journal_partner_link_id") REFERENCES "journal_partner_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_good_links" ADD CONSTRAINT "journal_partner_good_links_good_id_fkey" FOREIGN KEY ("good_id") REFERENCES "goods_and_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_partner_good_links" ADD CONSTRAINT "journal_partner_good_links_contextual_tax_code_id_fkey" FOREIGN KEY ("contextual_tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
