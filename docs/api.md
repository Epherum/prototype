ERP Application: The Authoritative Service Layer Guide
This document specifies the complete server-side business logic layer. All backend development and modifications must adhere to these specifications to ensure consistency, performance, and alignment with the application's architectural goals.
General Conventions
Return Signatures: All functions that return a list of entities for a slider/table must return an object of the shape { data: YourModel[], totalCount: number } to support pagination.
Parameter Naming: Array parameters for IDs must be plural (e.g., partnerIds: bigint[]).
Error Handling: Services should throw errors for invalid input (e.g., non-existent IDs). The API route handlers (/src/app/api/...) are responsible for catching these errors and returning appropriate HTTP status codes (e.g., 400, 404).
Security Context: Functions requiring user-level restrictions must accept a restrictedJournalId: string | null parameter. The service is responsible for applying the hierarchical filtering based on this ID.
src/app/services/journalService.ts
Purpose: Manages all queries and mutations related to the Journal entity and its hierarchical structure.
Function Signature Status
async getDescendantJournalIds(parentJournalId: string): Promise<string[]> ✅ EXISTING
async getJournalSubHierarchy(rootJournalId: string): Promise<Journal[]> ✅ EXISTING
async getJournalsForPartners(partnerIds: bigint[]): Promise<Journal[]> ✨ NEW
async getJournalsForGoods(goodIds: bigint[]): Promise<Journal[]> ✨ NEW
(...other existing CRUD functions like getJournalById, createJournal remain as-is)
✨ NEW: getJournalsForPartners
Signature: async getJournalsForPartners(partnerIds: bigint[]): Promise<Journal[]>
Purpose: Finds all unique Journals that one or more specified Partners are linked to.
Implementation Notes:
Query prisma.journalPartnerLink for all records where partnerId is in the input partnerIds array.
Use select: { journalId: true } and distinct: ['journalId'] to get a unique list of journal IDs.
Query prisma.journal to fetch the full Journal objects for the resulting IDs.
Usage Example: Used in slider order P -> J -> ... to populate the Journal slider based on Partner selections.
✨ NEW: getJournalsForGoods
Signature: async getJournalsForGoods(goodIds: bigint[]): Promise<Journal[]>
Purpose: Finds all unique Journals that one or more specified Goods are linked to.
Implementation Notes:
This is a two-step query:
a. Query prisma.journalPartnerGoodLink where goodId is in the goodIds array. Select the distinct journalPartnerLinkIds.
b. Query prisma.journalPartnerLink where id is in the IDs from the previous step. Select the distinct journalIds.
Query prisma.journal to fetch the full Journal objects for the resulting IDs.
Usage Example: Used in slider order G -> J -> ... to populate the Journal slider based on Good selections.
src/app/services/partnerService.ts & goodsService.ts
Purpose: Manages queries and mutations for Partner and GoodsAndService entities, including the new complex filtering modes. The logic is symmetrical for both services.
Function Signature Status
async getAllPartners(options: GetAllItemsOptions): Promise<{ data: Partner[], totalCount: number }> ✏️ MODIFIED
async getAllGoods(options: GetAllItemsOptions): Promise<{ data: GoodsAndService[], totalCount: number }> ✏️ MODIFIED
async findPartnersForGoods(options: IntersectionFindOptions): Promise<{ data: Partner[], totalCount: number }> ✏️ MODIFIED
async findGoodsForPartners(options: IntersectionFindOptions): Promise<{ data: GoodsAndService[], totalCount: number }> ✏️ MODIFIED
(...other existing CRUD functions like getPartnerById, createPartner remain as-is)
Type Definitions for Options
Generated typescript
// Define these shared types, e.g., in a new `src/lib/types/serviceOptions.ts`

type FilterMode = 'affected' | 'unaffected' | 'inProcess';

// For getAllPartners / getAllGoods
export interface GetAllItemsOptions {
take?: number;
skip?: number;
restrictedJournalId?: string | null; // User's top-level permission

// New Filtering Logic
filterMode?: FilterMode;
permissionRootId?: string; // The top-level journal of the current selection path (e.g., "4")
selectedJournalIds?: string[]; // The full path of selected journals (e.g., ["4", "40", "4001"])
}

// For findPartnersForGoods / findGoodsForPartners
export interface IntersectionFindOptions {
partnerIds?: bigint[];
goodIds?: bigint[];
journalIds?: string[]; // MODIFIED: Now an optional array
}
Use code with caution.
TypeScript
✏️ MODIFIED: getAllPartners / getAllGoods
Signature: async getAllPartners(options: GetAllItemsOptions): Promise<{ data: Partner[], totalCount: number }>
Purpose: A comprehensive fetch function that handles initial population and filtering by Journal selection with the new modes.
Implementation Notes:
The where clause will be built dynamically based on options.filterMode.
If filterMode is 'affected':
The most efficient query assumes the business rule ("must link to parent first") is enforced.
Filter the link table for links to the last journal in the selectedJournalIds array.
If filterMode is 'unaffected':
Perform a subquery to get all item IDs linked to the last journal in selectedJournalIds.
Query for items linked to any journal under permissionRootId (using getDescendantJournalIds) WHERE the item ID is notIn the list from the subquery.
If filterMode is 'inProcess':
The where clause will be: { approvalStatus: 'PENDING', linkTable: { some: { journalId: { in: selectedJournalIds } } } }.
If filterMode is not provided:
The function should simply respect the restrictedJournalId for initial population.
Usage Example: The primary function used by the Partner/Good slider when it appears after the Journal slider (J -> P -> ... or J -> G -> ...).
✏️ MODIFIED: findPartnersForGoods / findGoodsForPartners
Signature: async findGoodsForPartners(options: IntersectionFindOptions): Promise<{ data: GoodsAndService[], totalCount: number }>
Purpose: Finds items that are common to ALL specified counterparts, optionally filtered by a set of journals.
Implementation Notes:
The journalId: string parameter is replaced by journalIds: string[] and is now optional.
The core intersection logic (using groupBy and having count) remains the same.
If journalIds is provided and is not empty, the initial query on JournalPartnerLink must be modified to use where: { journalId: { in: journalIds } }.
Usage Example: Used in J -> P -> G (find goods for selected partners within selected journals) or P -> G (find goods common to selected partners, ignoring journal context).
src/app/services/documentService.ts
Purpose: Manages all queries and mutations for the Document and DocumentLine entities, leveraging the new denormalized schema fields for performance.
Function Signature Status
async createDocument(data: CreateDocumentData, journalId: string, ...): Promise<Document> ✏️ MODIFIED
async getAllDocuments(options: GetAllDocumentsOptions): Promise<{ data: Document[], totalCount: number }> ✨ NEW
`async getDocumentById(id: bigint): Promise<Document	null>`
getDocuments(...) ❌ DEPRECATED
(...other existing CRUD functions like updateDocument, deleteDocument remain as-is)
Type Definitions for Options
Generated typescript
export interface GetAllDocumentsOptions {
take?: number;
skip?: number;
restrictedJournalId?: string | null; // User's permission

// Filtering by selections in other sliders
filterByJournalIds?: string[];
filterByPartnerIds?: bigint[];
filterByGoodIds?: bigint[];
}
Use code with caution.
TypeScript
✏️ MODIFIED: createDocument
Signature: async createDocument(data: CreateDocumentData, createdById: string, journalId: string, ...): Promise<Document & { lines: DocumentLine[] }>
Purpose: Creates a new Document and its lines, now populating the new denormalized fields.
Implementation Notes:
The function signature must be updated to accept journalId: string.
When creating the Document record, set the journalId field with the provided value.
When creating the DocumentLine records (lines: { create: ... }), you must now also populate the new goodId field on each line. The goodId is available from the journalPartnerGoodLink which you can look up or have passed in the data.lines payload.
Usage Example: The core function for creating any new business document.
✨ NEW: getAllDocuments
Signature: async getAllDocuments(options: GetAllDocumentsOptions): Promise<{ data: Document[], totalCount: number }>
Purpose: The new, powerful fetching function for the Document slider, capable of filtering by Journals, Partners, and Goods.
Implementation Notes:
This function replaces the old, simple getDocuments.
Build a dynamic where: Prisma.DocumentWhereInput clause.
If filterByJournalIds is provided, add journalId: { in: filterByJournalIds }. (Thanks to our schema change, this is now simple).
If filterByPartnerIds is provided, add partnerId: { in: filterByPartnerIds }.
If filterByGoodIds is provided, add a relational filter: lines: { some: { goodId: { in: filterByGoodIds } } }.
Always respect the user's restrictedJournalId by filtering on the top-level journal and its descendants.
Usage Example: The primary function for the Document slider in any permutation (e.g., J -> P -> D, G -> D -> ...).
✏️ MODIFIED: getDocumentById
Signature: async getDocumentById(id: bigint): Promise<Document | null>
Purpose: Fetches a single document, now efficiently including its full good details.
Implementation Notes:
Update the include clause to leverage our schema changes.
The new clause should be: include: { partner: true, lines: { include: { good: true } } }.
This avoids a second N+1 query on the frontend to get good details for each line.
Usage Example: Used in the "Gateway Lookup" mode (D -> P -> G) to display the contents of a selected document.
Linking Services (journalGoodLinkService, etc.)
Status: ✅ EXISTING & STABLE. These services are mostly low-level helpers.
Required Action: Business Logic Enforcement.
The most critical action here is not to add new functions, but to enforce the hierarchical linking rule within the existing createLink functions.
In journalPartnerLinkService.createLink and journalGoodLinkService.createLink, before creating a link to a child journal (e.g., 4001), the service MUST query the database to verify that a link for the same item already exists for the parent journal (40). If it does not, the function must throw an error. This guarantees the data integrity our "Affected" filter mode relies on.

The API Layer Structure (src/app/api/...)
This section outlines the general structure of the API routes that will consume the service functions. The API layer acts as a thin, secure translator between HTTP requests and our robust service layer.
Core Principles:
RESTful Design: We will use standard HTTP methods (GET, POST, PUT, DELETE) on resource-based URLs (e.g., /api/partners, /api/documents/[id]).
Single Flexible Endpoint: For fetching data, we will favor a single, powerful GET endpoint per resource that uses query parameters to handle different filtering scenarios, rather than creating dozens of specific endpoints.
Validation: All incoming request bodies and query parameters will be rigorously validated using Zod schemas to ensure type safety and prevent invalid data from reaching the service layer.
Authorization: Every route will be wrapped with the withAuthorization HOF to enforce permissions before any service logic is executed. The user session will be the source for restrictedJournalId.
API Endpoint Specifications
Resource: Journals
Endpoint: GET /api/journals
Purpose: Fetches journals based on various contexts. This endpoint is unique as it serves multiple distinct use cases.
Query Parameters:
rootJournalId: string (optional): If present, fetches the sub-hierarchy for a restricted user. Calls journalService.getJournalSubHierarchy(rootJournalId).
findByPartnerIds: string (optional, comma-separated bigint): If present, finds journals linked to the given partners. Calls journalService.getJournalsForPartners([...]).
findByGoodIds: string (optional, comma-separated bigint): If present, finds journals linked to the given goods. Calls journalService.getJournalsForGoods([...]).
Logic: The route handler will use an if/else if/else block to determine which service function to call based on the provided query parameters.
Resource: Partners
Endpoint: GET /api/partners
Purpose: The single endpoint for fetching partners for all slider scenarios.
Query Parameters:
take: number, skip: number (for pagination).
filterMode: 'affected' | 'unaffected' | 'inProcess' (optional): Specifies the journal filtering mode.
permissionRootId: string (optional): The top-level journal of the selection path. Required for 'unaffected' mode.
selectedJournalIds: string (optional, comma-separated): The full path of selected journals. Required for all filterModes.
intersectionOfGoodIds: string (optional, comma-separated bigint): For finding partners common to a set of goods.
Logic:
The handler first checks if intersectionOfGoodIds is present.
If YES: It calls partnerService.findPartnersForGoods({ goodIds: [...], journalIds: [...] }).
If NO: It calls partnerService.getAllPartners({ ... }) with the pagination and filterMode options.
Resource: Goods & Services
Endpoint: GET /api/goods
Purpose: The single endpoint for fetching goods for all slider scenarios.
Query Parameters:
take: number, skip: number (for pagination).
filterMode: 'affected' | 'unaffected' | 'inProcess' (optional): Specifies the journal filtering mode.
permissionRootId: string (optional): The top-level journal of the selection path.
selectedJournalIds: string (optional, comma-separated): The full path of selected journals.
intersectionOfPartnerIds: string (optional, comma-separated bigint): For finding goods common to a set of partners.
Logic:
The handler first checks if intersectionOfPartnerIds is present.
If YES: It calls goodsService.findGoodsForPartners({ partnerIds: [...], journalIds: [...] }).
If NO: It calls goodsService.getAllGoods({ ... }) with the pagination and filterMode options.
Resource: Documents
Endpoint: GET /api/documents
Purpose: The new, powerful endpoint for fetching documents based on any combination of upstream slider selections.
Query Parameters:
take: number, skip: number (for pagination).
filterByJournalIds: string (optional, comma-separated).
filterByPartnerIds: string (optional, comma-separated bigint).
filterByGoodIds: string (optional, comma-separated bigint).
Logic:
The handler parses all provided filter parameters.
It calls the new documentService.getAllDocuments({ ... }) with all parsed options.
Endpoint: GET /api/documents/[id]
Purpose: Fetches a single, detailed document for the "Gateway Lookup" view.
Logic: Calls the modified documentService.getDocumentById(id).
CRUD Operations (Example: Partners)
POST /api/partners
Body: A JSON object matching the Zod schema for CreatePartnerData.
Logic: Calls partnerService.createPartner(data, user.id).
PUT /api/partners/[id]
Body: A JSON object matching the Zod schema for UpdatePartnerData.
Logic: Calls partnerService.updatePartner(id, data).
DELETE /api/partners/[id]
Logic: Calls partnerService.deletePartner(id).
This API structure provides the necessary flexibility to power our sophisticated frontend while maintaining a clean, logical, and secure separation of concerns. The development team can now proceed to build or modify the API routes and service functions according to these exact specifications.

1. Resource: journal-partner-links
   File Location: src/app/api/journal-partner-links/route.ts (This will be the only file for this resource).
   Logic: This single file will contain handlers for POST, GET, and DELETE.
   POST /api/journal-partner-links
   Action: Creates a new link between a Journal and a Partner.
   Body: Same as your existing POST route.
   Status: ✅ No changes needed, just move the code into this consolidated file and wrap with withAuthorization.
   GET /api/journal-partner-links
   Action: Fetches one or more JournalPartnerLink records.
   Query Parameters (Zod-validated):
   linkId: bigint (optional): Fetches a single link by its unique ID.
   journalId: string (optional): Fetches all links for a specific journal.
   partnerId: bigint (optional): Fetches all links for a specific partner.
   Logic:
   The handler dynamically builds a Prisma.JournalPartnerLinkWhereInput object based on the provided query params.
   If linkId is present, it uses prisma.journalPartnerLink.findUnique().
   Otherwise, it uses prisma.journalPartnerLink.findMany() with the constructed where clause.
   DELETE /api/journal-partner-links
   Action: Deletes one or more JournalPartnerLink records.
   Query Parameters (Zod-validated):
   linkId: bigint (optional): Deletes a single link by its unique ID.
   journalId: string & partnerId: bigint & partnershipType: string (optional, all required if one is present): Deletes a link by its composite key.
   Logic:
   The Zod schema will enforce that either linkId or the composite key is provided.
   If linkId is present, call journalPartnerLinkService.deleteLinkById().
   If composite key is present, call journalPartnerLinkService.deleteLinkByJournalAndPartner().
2. Resource: journal-good-links
   File Location: src/app/api/journal-good-links/route.ts (The only file).
   Logic: Follows the exact same consolidated pattern as journal-partner-links.
   POST /api/journal-good-links
   Action: Creates a new link between a Journal and a Good.
   Status: ✅ No changes needed, just consolidate.
   GET /api/journal-good-links
   Query Parameters: linkId: bigint, journalId: string, goodId: bigint (all optional).
   Logic: Same dynamic where clause builder as above.
   DELETE /api/journal-good-links
   Query Parameters: linkId: bigint (optional) OR (journalId: string & goodId: bigint) (optional).
   Logic: Same if/else logic to call the correct service function (deleteLinkById or deleteLinkByJournalAndGood).
3. Resource: journal-partner-good-links
   File Location: src/app/api/journal-partner-good-links/route.ts (The only file).
   Logic: Similar pattern, but the GET query is slightly different as it often serves contextual lookups.
   POST /api/journal-partner-good-links
   Action: Creates the full three-way link using the orchestration service.
   Status: ✅ No changes needed, your existing createFullJpgLink logic is correct.
   GET /api/journal-partner-good-links
   Action: Fetches one or more JournalPartnerGoodLink records.
   Query Parameters:
   linkId: bigint (optional): Fetches a single link by its unique ID.
   journalPartnerLinkId: bigint (optional): Fetches all goods linked to a specific Journal-Partner relationship (replaces the old GET with this param).
   goodId: bigint & journalId: string (optional, both required if one is present): Fetches links for a specific good in the context of a journal (replaces /for-context).
   Logic: The handler builds a where clause based on the provided parameters to call the appropriate service function (getLinkById, getFullLinksForJPL, or getJpglsForGoodAndJournalContext).
   DELETE /api/journal-partner-good-links
   Query Parameters:
   linkId: bigint (optional): Deletes a single link by its unique ID.
   journalPartnerLinkId: bigint & goodId: bigint (optional): Deletes a link by its composite key.
   Logic: Same if/else logic as the other DELETE handlers.
