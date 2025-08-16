# Backend Services Documentation

This document provides an overview of the backend services, detailing their responsibilities and key functions. These services interact with the database (via Prisma) and encapsulate business logic, providing a clean API for the Next.js API routes.

## 1. `documentService.ts`

*   **Purpose:** Manages CRUD operations and business logic related to `Document` entities. Handles document creation, retrieval, updates, and soft deletion.
*   **Key Functions:**
    *   `createDocument(data, createdById, journalId)`: Creates a new document, calculates totals (HT, Tax, TTC, Balance), and denormalizes `journalId` and `goodId` onto `DocumentLine` for efficient filtering.
    *   `getAllDocuments(options)`: Fetches documents with pagination and filtering by `journalIds`, `partnerIds`, and `goodIds`. Applies user's `restrictedJournalId` for security.
    *   `getDocumentById(id)`: Retrieves a single document by ID, including associated `partner` and `lines` with `good` details.
    *   `updateDocument(id, data)`: Updates an existing document.
    *   `deleteDocument(id, deletedById)`: Soft deletes a document by updating its `entityState` to 'DELETED'.
*   **Business Logic/Features:** Document total calculation, denormalization for filtering, hierarchical journal-based security, soft deletion.

## 2. `goodsService.ts`

*   **Purpose:** Manages CRUD operations and complex filtering for `GoodsAndService` entities.
*   **Key Functions:**
    *   `createGood(data)`: Creates a new good, including validation for associated `taxCodeId` and `unitCodeId`.
    *   `getGoodById(id)`: Retrieves a single good by ID, including its `taxCode` and `unitOfMeasure`.
    *   `getAllGoods(options)`: A comprehensive function for fetching goods. It supports:
        *   `filterMode`: Filters goods based on their linkage to journals (`affected`, `unaffected`). `inProcess` mode is noted as not applicable.
        *   `restrictedJournalId`: Applies user-specific journal permissions.
        *   `selectedJournalIds`: Filters based on selected journals.
    *   `findGoodsForPartners(options)`: Finds goods that are common to *all* specified partners, optionally within specific journal contexts. This involves advanced intersectional querying.
    *   `updateGood(id, data)`: Updates an existing good.
    *   `deleteGood(id)`: Deletes a good.
*   **Business Logic/Features:** Dynamic filtering of goods based on journal linkages, intersectional search for goods common to multiple partners, and validation of related entities.

## 3. `journalGoodLinkService.ts`

## 3. `journalGoodLinkService.ts`

*   **Purpose:** Manages the creation, retrieval, and deletion of `JournalGoodLink` entities, which associate a Journal with a Good. It enforces the hierarchical linking business rule.
*   **Key Functions:**
    *   `createLink(data)`: Creates a new link. **Enforces the business rule that a Good cannot be linked to a child Journal unless it is already linked to its parent Journal.**
    *   `getLinkById(linkId)`: Retrieves a specific link by its ID.
    *   `deleteLinkById(linkId)`: Deletes a link by its ID.
    *   `deleteLinkByJournalAndGood(journalId, goodId)`: Deletes links based on a composite key (Journal ID and Good ID).
    *   `getGoodsForJournals(journalIds, includeChildren)`: Retrieves all Goods linked to specified Journals, optionally including those linked to their descendant Journals.
    *   `getJournalsForGood(goodId)`: Retrieves all Journals that a specific Good is linked to.
    *   `getLinksForGood(goodId)`: Retrieves all `JournalGoodLink` records for a specific Good.
    *   `getLinksForJournal(journalId)`: Retrieves all `JournalGoodLink` records for a specific Journal.
*   **Business Logic/Features:** Hierarchical linking enforcement for Goods, management of Journal-Good many-to-many relationships.

## 4. `journalPartnerGoodLinkService.ts`

## 4. `journalPartnerGoodLinkService.ts`

*   **Purpose:** Manages the complex three-way `JournalPartnerGoodLink` (JPGL) entities, which link a Journal, a Partner, and a Good. It includes orchestration logic to ensure the underlying `JournalPartnerLink` exists.
*   **Key Functions:**
    *   `createFullJpgLink(data)`: Orchestrates the creation of a JPGL. It first finds or creates the necessary `JournalPartnerLink` (JPL) and then creates the JPGL.
    *   `getJpglsForGoodAndJournalContext(goodId, journalId)`: Retrieves JPGLs for a specific Good within a given Journal context.
    *   `createLink(data)`: (Lower-level) Creates a raw JPGL given an existing `journalPartnerLinkId` and `goodId`.
    *   `getLinkById(id)`: Retrieves a specific JPGL by its ID.
    *   `deleteLinkById(id)`: Deletes a JPGL by its ID.
    *   `getGoodsForJournalPartnerLink(journalPartnerLinkId)`: Retrieves all Goods linked to a specific JPL.
    *   `getJournalPartnerLinksForGood(goodId)`: Retrieves all JPLs associated with a specific Good.
    *   `getFullLinksForJPL(journalPartnerLinkId)`: Retrieves all JPGLs for a specific JPL, including Good and contextual tax code details.
    *   `getGoodsForJournalsAndPartner(journalIds, partnerId, includeJournalChildren)`: Core filtering logic to retrieve Goods linked to specified Journals (and their children) AND a specific Partner.
    *   `getPartnerIdsForGood(goodId)`: Retrieves all Partner IDs linked to a specific Good via JPGLs.
    *   `getGoodIdsForPartner(partnerId)`: Retrieves all Good IDs linked to a specific Partner via JPGLs.
    *   `getPartnerIdsForJournalsAndGood(journalIds, goodId, includeJournalChildren)`: Retrieves Partner IDs linked to specified Journals (and their children) AND a specific Good.
    *   `getJournalIdsForPartnerAndGood(partnerId, goodId)`: Retrieves Journal IDs linked to a specific Partner AND Good.
*   **Business Logic/Features:** Orchestrated creation of three-way links, complex intersectional filtering for Goods, Partners, and Journals based on the three-way link, and various lookup functions for the three-way relationship.

## 5. `journalPartnerLinkService.ts`

## 5. `journalPartnerLinkService.ts`

*   **Purpose:** Manages the creation, retrieval, and deletion of `JournalPartnerLink` entities, which associate a Journal with a Partner. It enforces the hierarchical linking business rule.
*   **Key Functions:**
    *   `createLink(data)`: Creates a new link. **Enforces the business rule that a Partner cannot be linked to a child Journal unless it is already linked to its parent Journal.**
    *   `getLinkById(linkId)`: Retrieves a specific link by its ID.
    *   `deleteLinkById(linkId)`: Deletes a link by its ID. This action cascades to delete associated `JournalPartnerGoodLink` records.
    *   `deleteLinkByJournalAndPartner(journalId, partnerId, partnershipType)`: Deletes links based on a composite key (Journal ID, Partner ID, and optionally `partnershipType`).
    *   `getPartnersForJournals(journalIds, includeChildren)`: Retrieves all Partners linked to specified Journals, optionally including those linked to their descendant Journals.
    *   `getJournalsForPartner(partnerId)`: Retrieves all Journals that a specific Partner is linked to.
    *   `getLinksForPartner(partnerId)`: Retrieves all `JournalPartnerLink` records for a specific Partner.
    *   `getLinksForJournal(journalId)`: Retrieves all `JournalPartnerLink` records for a specific Journal.
    *   `findByJournalAndPartner(journalId, partnerId)`: Finds a specific (or the first) link by Journal ID and Partner ID.
*   **Business Logic/Features:** Hierarchical linking enforcement for Partners, management of Journal-Partner many-to-many relationships, and cascading deletion of related three-way links.

## 6. `journalService.ts`

## 7. `partnerService.ts`

## 8. `roleService.ts`

## 9. `userService.ts`

## 10. `service.types.ts` (Type Definitions)