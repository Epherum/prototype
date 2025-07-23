Part III: Appendix - Backend API Reference
This document provides a detailed, route-by-route reference for the ERP application's backend API. It is intended for developers who have already read the main "In-Depth Developer Onboarding" guide.
Resource: Documents
Handles creation, retrieval, and management of business documents. These routes are currently public-facing or require only basic authentication, as they are not tied to the core permission system.
GET /api/documents
Purpose: Retrieves a paginated list of documents, typically filtered by a specific partner.
Authorization: Public. No authentication is required to list documents.
Request:
Query Parameters:
partnerId (string, required): The BigInt ID of the partner whose documents are being requested.
Response:
200 OK: { data: Document[], total: number } - An object containing the list of documents and the total count for pagination.
400 Bad Request: If the partnerId parameter is missing or invalid.
Core Logic: A straightforward fetch from the documentService based on the provided partnerId.
POST /api/documents
Purpose: Creates a new document.
Authorization: Requires Authentication. Any logged-in user can create a document. No specific "MANAGE" permission is checked.
Request:
Body (JSON): A document object that must conform to the createDocumentSchema defined in the documentService. Includes fields like partnerId, documentType, lines (the items in the document), etc.
Response:
201 Created: The full, newly created Document object, including its database-generated ID.
400 Bad Request: If the request body fails validation against the Zod schema.
401 Unauthorized: If the request is made without a valid session.
Core Logic: Validates the incoming payload, injects server-side data (createdById, createdByIp), and calls the documentService to create the record and its associated lines within a transaction.
GET /api/documents/[id]
Purpose: Retrieves a single document by its unique ID.
Authorization: Public.
Request:
Path Parameter: id (string): The BigInt ID of the document.
Response:
200 OK: The full Document object with its lines.
404 Not Found: If no document with the given ID exists.
PUT /api/documents/[id]
Purpose: Updates an existing document.
Authorization: Public.
Request:
Path Parameter: id (string): The BigInt ID of the document to update.
Body (JSON): An object containing the fields to update, conforming to the updateDocumentSchema.
Response:
200 OK: The full, updated Document object.
404 Not Found: If the document to update does not exist.
Core Logic: Validates the payload and passes the changes to the documentService to perform the update.
DELETE /api/documents/[id]
Purpose: Deletes a document.
Authorization: Requires Authentication.
Request:
Path Parameter: id (string): The BigInt ID of the document to delete.
Response:
204 No Content: On successful deletion.
404 Not Found: If the document to delete does not exist.
Core Logic: Ensures the user is logged in, then calls the documentService to perform a soft or hard delete, potentially creating an audit trail entry with the deleting user's ID.
Resource: Goods
Manages the core Goods/Services entities. These routes are central to the "Goods" slider in the UI.
GET /api/goods
Purpose: Fetches a list of goods, supporting complex filtering scenarios for the "Goods" slider.
Authorization: Requires Authentication.
Request:
Query Parameters (Two main modes):
J-P-G Context Mode (Journal -> Partner -> Goods): Used when the Goods slider is preceded by both a Journal and Partner slider.
forJournalIds (string): Comma-separated list of Journal IDs.
forPartnerId (string): The ID of the selected Partner.
includeJournalChildren (boolean string): Whether to include goods linked to child journals.
Standard Filter Mode: Used in all other scenarios (e.g., Goods is the first slider, or only preceded by Journal).
filterStatuses (string): Comma-separated list (e.g., affected, unaffected).
contextJournalIds (string): Comma-separated list of Journal IDs, used when filterStatuses includes affected.
restrictedJournalId (string): The current user's top-level journal restriction, used to scope the results for sub-admins.
limit, offset: For pagination.
Response:
200 OK: { data: Good[], total: number } - A paginated list of goods.
Core Logic: The route handler has a crucial priority system:
It first checks for the forJournalIds and forPartnerId parameters. If present, it bypasses the main goodsService and uses the jpgLinkService to fetch a very specific set of goods linked to both the given journals and the partner.
If those are not present, it falls back to the goodsService.getAllGoods method, passing the standard filter parameters to handle the "Affected/Unaffected" logic and sub-admin restrictions. This logic directly powers the frontend's dynamic data fetching.
POST /api/goods
Purpose: Creates a new Good or Service.
Authorization: Requires Authentication. (Could be further restricted by a "MANAGE_GOODS" permission if needed).
Request:
Body (JSON): A good object conforming to createGoodsSchema.
Response:
201 Created: The newly created Good object.
409 Conflict: If a good with the same unique identifier (e.g., referenceCode) already exists.
GET /api/goods/[id]
Purpose: Retrieves a single good by its ID.
Authorization: Requires Authentication.
Response:
200 OK: The full Good object.
404 Not Found: If the good does not exist.
PUT /api/goods/[id]
Purpose: Updates an existing good.
Authorization: Requires Authentication.
Request:
Body (JSON): An object with fields to update, conforming to updateGoodsSchema.
Response:
200 OK: The updated Good object.
404 Not Found: If the good to update does not exist.
DELETE /api/goods/[id]
Purpose: Deletes a good.
Authorization: Requires Authentication.
Response:
200 OK: A success message.
404 Not Found: If the good to delete does not exist.
GET /api/goods/[id]/journal-links
Purpose: Fetches all the JournalGoodLink records for a specific good. This is used in the UI to show which journals a good is directly linked to.
Authorization: Requires Authentication.
Request:
Path Parameter: id (string): The ID of the Good.
Response:
200 OK: An array of JournalGoodLinkWithDetails objects, which include the journal's name and code.
Resource Group: Link Tables
These routes manage the many-to-many relationships between the core entities. They do not represent a slider themselves but are called by other services or UI components to establish or query these connections.
POST /api/journal-good-links
Purpose: Creates a direct link between a Journal and a Good.
Response:
201 Created: The new JournalGoodLink object.
409 Conflict: If the link already exists.
404 Not Found: If the specified Journal or Good does not exist.
DELETE /api/journal-good-links/[linkId]
Purpose: Deletes a direct link between a Journal and a Good.
POST /api/journal-partner-links
Purpose: Creates a direct link between a Journal and a Partner.
Response:
201 Created: The new JournalPartnerLink object.
409 Conflict: If the link already exists.
404 Not Found: If the specified Journal or Partner does not exist.
DELETE /api/journal-partner-links/[linkId]
Purpose: Deletes a direct link between a Journal and a Partner.
GET /api/journal-partner-links/findByContext
Purpose: A specialized lookup to find a single JournalPartnerLink ID given a journalId and a partnerId. This is a utility endpoint used by the frontend to get the ID of the parent link before creating a three-way JournalPartnerGoodLink.
Request:
Query Parameters: journalId, partnerId.
Response:
200 OK: The JournalPartnerLink object if found.
404 Not Found: If no link exists for that specific combination.
POST /api/journal-partner-good-links
Purpose: Creates the critical three-way link between a Journal, Partner, and Good. This represents a specific transaction context.
Response:
201 Created: The new JournalPartnerGoodLink object.
409 Conflict: If this exact three-way link already exists.
404 Not Found: If any of the three referenced entities do not exist.
GET /api/journal-partner-good-links
Purpose: Retrieves a list of JournalPartnerGoodLink records, filtered by a journalPartnerLinkId. This is used to fetch all goods associated with a specific Journal-Partner pair.
Request:
Query Parameters: journalPartnerLinkId (string, required).
DELETE /api/journal-partner-good-links/[linkId]
Purpose: Deletes a specific three-way link.
GET /api/journal-partner-good-links/for-context
Purpose: A specialized lookup to find all partners linked to a specific Good within a specific Journal. This supports the G -> J -> P slider flow.
Request:
Query Parameters: goodId, journalId.
Response:
200 OK: An array of JournalPartnerGoodLink objects that match the context.
Resource: Journals (Chart of Accounts)
Manages the hierarchical journal structure. Central to the "Journal" slider.
GET /api/journals
Purpose: A highly versatile endpoint for fetching journals based on various contexts.
Authorization: Requires Authentication.
Request:
Query Parameters (mutually exclusive modes):
Linked Entity Mode: Fetches journals linked to other entities.
linkedToPartnerId (string): Get all journals linked to this partner.
linkedToGoodId (string): Get all journals linked to this good.
(If both are provided, finds journals linked to both).
Hierarchy Mode: Fetches parts of the journal tree.
parentId (string): Get immediate children of this journal.
root=true: Get only the top-level (root) journals.
restrictedTopLevelJournalId & fetchSubtree=true: Fetches the entire sub-hierarchy starting from the given ID. This is used to populate the journal selection dropdown for a restricted admin.
Default Mode: If no parameters are given, it fetches all journals.
Response:
200 OK: An array of Journal objects.
Core Logic: This route is a router in itself. It inspects the query parameters to decide which service method to call, enabling the complex and dynamic behavior of the Journal slider when it's in "Secondary (Flat) Mode" vs. "Primary Mode".
POST /api/journals
Purpose: Creates a new journal entry.
Response:
201 Created: The new Journal object.
409 Conflict: If a journal with the same ID (which is user-defined) already exists.
GET /api/journals/[id]
Purpose: Retrieves a single journal's details.
PUT /api/journals/[id]
Purpose: Updates a journal's properties (e.g., name, isTerminal).
DELETE /api/journals/[id]
Purpose: Deletes a journal.
Core Logic: Contains important safety checks in the journalService. It will fail with a 409 Conflict if the journal has child journals or is assigned as a restriction to a user or role, preventing orphaned data.
GET /api/journals/all-for-admin-selection
Purpose: Fetches a flat list of all journals, intended specifically for populating admin UI elements, like the user restriction dropdown.
Authorization: Requires Permission. Wrapped in withAuthorization and requires { action: "MANAGE", resource: "USERS" }.
GET /api/journals/top-level
Purpose: Fetches only the root-level journals.
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }).
Resource: Partners
Manages Customers, Suppliers, and other business partners.
GET /api/partners
Purpose: Fetches a list of partners, supporting complex filtering for the "Partner" slider.
Authorization: Requires Authentication.
Request:
Query Parameters (Two main modes):
Linked Entity Mode (J-G-P / G-J-P): Used when the Partner slider is preceded by Journal and Goods.
linkedToJournalIds (string): Comma-separated list of Journal IDs.
linkedToGoodId (string): The ID of the selected Good.
Standard Filter Mode: Used when Partner is the first slider or preceded only by Journal.
filterStatuses (string): e.g., affected, unaffected.
contextJournalIds (string): Used when filterStatuses includes affected.
restrictedJournalId (string): For sub-admin data scoping.
Response:
200 OK: { data: Partner[], total: number } - A paginated list of partners.
Core Logic: Similar to GET /api/goods, this route prioritizes the linked-entity context first, calling the jpgLinkService to get a precise list of partner IDs. If that context isn't present, it falls back to the partnerService for standard filtering.
POST /api/partners
Purpose: Creates a new partner.
GET /api/partners/[id]
Purpose: Retrieves a single partner by ID.
PUT /api/partners/[id]
Purpose: Updates an existing partner.
DELETE /api/partners/[id]
Purpose: Deletes a partner.
GET /api/partners/[id]/journal-links
Purpose: Fetches all JournalPartnerLink records for a specific partner. Used in the UI to show which journals a partner is directly linked to.
Response:
200 OK: An array of JournalLinkWithDetailsClientResponse objects.
GET /api/partners/[id]/goods-via-jpgl
Purpose: A crucial endpoint for the J -> P -> G slider flow. Given a Partner ID (from the path) and a Journal ID (from the query), it finds all goods that are three-way linked in that specific context.
Request:
Path Parameter: id (Partner ID).
Query Parameter: journalId (string, required).
Core Logic: It first finds the JournalPartnerLink for the given IDs. Then, it uses that link's ID to query the JournalPartnerGoodLink table to find all associated goods.
Resource Group: Users & Roles
Handles all authentication, authorization, and user management. These routes are heavily protected.
GET /api/permissions
Purpose: Fetches a list of all possible permissions available in the system (e.g., MANAGE_USERS, VIEW_REPORTS).
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }). This is used to populate the checklist when creating or editing a role.
GET /api/roles
Purpose: Fetches a list of all user roles.
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }).
POST /api/roles
Purpose: Creates a new user role and associates it with a set of permissions.
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }).
PUT /api/roles/[id]
Purpose: Updates an existing role's name, description, and permission set.
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }).
DELETE /api/roles/[id]
Purpose: Deletes a role. The service layer should prevent deletion if the role is assigned to any users.
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }).
POST /api/users
Purpose: Creates a new user, hashes their password, and assigns them roles.
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }).
Core Logic: Contains the critical "Sub-Admin" Security Check. It verifies if the creating admin is themselves restricted. If so, it uses the isDescendantOf helper to ensure the new user's restrictedTopLevelJournalId is a child of (or the same as) the admin's own restriction. This prevents a sub-admin from creating a user with more permissions than they have.
GET /api/users/[id]
Purpose: Retrieves a single user's details, including their assigned roles. The password hash is explicitly removed from the response.
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }).
PUT /api/users/[id]
Purpose: Updates a user's details, roles, and optionally their password.
Authorization: Requires Permission ({ action: "MANAGE", resource: "USERS" }).
