-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'QUOTE', 'PURCHASE_ORDER', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "DocumentState" AS ENUM ('DRAFT', 'FINALIZED', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "documents" (
    "id" BIGSERIAL NOT NULL,
    "ref_doc" TEXT NOT NULL,
    "type_document" "DocumentType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "state" "DocumentState" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "document_scan_url" TEXT,
    "partner_id" BIGINT NOT NULL,
    "previous_document_id" BIGINT,
    "total_ht" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_taxe" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_ttc" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_exoneration" DECIMAL(18,4),
    "total_paid" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "header_text" TEXT,
    "footer_text" TEXT,
    "mode_paiement" TEXT,
    "entity_state" "EntityState" NOT NULL DEFAULT 'ACTIVE',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_id" TEXT NOT NULL,
    "created_by_ip" VARCHAR(45),
    "deleted_by_id" TEXT,
    "deleted_by_ip" VARCHAR(45),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_lines" (
    "id" BIGSERIAL NOT NULL,
    "document_id" BIGINT NOT NULL,
    "journal_partner_good_link_id" BIGINT NOT NULL,
    "designation" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "prix_unitaire" DECIMAL(18,4) NOT NULL,
    "remise" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "taxe" DECIMAL(5,4) NOT NULL,
    "unite" TEXT,
    "montant_remise" DECIMAL(18,4) NOT NULL,
    "montant_taxe" DECIMAL(18,4) NOT NULL,
    "ht_and_net" DECIMAL(18,4) NOT NULL,
    "helper_est_exo" BOOLEAN NOT NULL DEFAULT false,
    "helper_est_deductible" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_ref_doc_key" ON "documents"("ref_doc");

-- CreateIndex
CREATE UNIQUE INDEX "documents_previous_document_id_key" ON "documents"("previous_document_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_previous_document_id_fkey" FOREIGN KEY ("previous_document_id") REFERENCES "documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_journal_partner_good_link_id_fkey" FOREIGN KEY ("journal_partner_good_link_id") REFERENCES "journal_partner_good_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
