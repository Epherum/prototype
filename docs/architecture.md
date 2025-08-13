ERP Application: The Authoritative Service Layer Guide
This document specifies the complete server-side business logic layer. All backend development and modifications must adhere to these specifications to ensure consistency, performance, and alignment with the application's architectural goals.
General Conventions
Return Signatures: All functions that return a list of entities for a slider/table must return an object of the shape { data: YourModel[], totalCount: number } to support pagination.
Parameter Naming: Array parameters for IDs must be plural (e.g., partnerIds: bigint[]).
Error Handling: Services should throw errors for invalid input (e.g., non-existent IDs). The API route handlers (/src/app/api/...) are responsible for catching these errors and returning appropriate HTTP status codes (e.g., 400, 404).
Security Context: Functions requiring user-level restrictions must accept a restrictedJournalId: string | null parameter. The service is responsible for applying the hierarchical filtering based on this ID.
Service Layer Specifications
src/app/services/journalService.ts
Purpose: Manages all queries and mutations related to the Journal entity and its hierarchical structure.
Functions:
async getDescendantJournalIds(parentJournalId: string): Promise<string[]>
async getJournalSubHierarchy(rootJournalId: string): Promise<Journal[]>
async getJournalsForPartners(partnerIds: bigint[]): Promise<Journal[]>
async getJournalsForGoods(goodIds: bigint[]): Promise<Journal[]>
(...other CRUD functions like getJournalById, createJournal)
Function Details:
async getJournalsForPartners(partnerIds: bigint[]): Promise<Journal[]>
Purpose: Finds all unique Journals that one or more specified Partners are linked to.
Implementation: Queries prisma.journalPartnerLink for all records where partnerId is in the input partnerIds array. Uses select: { journalId: true } and distinct: ['journalId'] to get a unique list of journal IDs, then fetches the full Journal objects for those IDs.
Usage Example: Used in slider order P -> J -> ... to populate the Journal slider based on Partner selections.
async getJournalsForGoods(goodIds: bigint[]): Promise<Journal[]>
Purpose: Finds all unique Journals that one or more specified Goods are linked to.
Implementation: This is a two-step query:
Query prisma.journalPartnerGoodLink where goodId is in goodIds to get distinct journalPartnerLinkIds.
Query prisma.journalPartnerLink where id is in the IDs from step 1 to get distinct journalIds.
Finally, query prisma.journal to fetch the full Journal objects.
Usage Example: Used in slider order G -> J -> ... to populate the Journal slider based on Good selections.
src/app/services/partnerService.ts & goodsService.ts
Purpose: Manages queries and mutations for Partner and GoodsAndService entities, including complex filtering modes. The logic is symmetrical for both services.
Functions:
async getAllPartners(options: GetAllItemsOptions): Promise<{ data: Partner[], totalCount: number }>
async getAllGoods(options: GetAllItemsOptions): Promise<{ data: GoodsAndService[], totalCount: number }>
async findPartnersForGoods(options: IntersectionFindOptions): Promise<{ data: Partner[], totalCount: number }>
async findGoodsForPartners(options: IntersectionFindOptions): Promise<{ data: GoodsAndService[], totalCount: number }>
(...other CRUD functions like getPartnerById, createPartner)
Shared Type Definitions (src/lib/types/serviceOptions.ts):
Generated typescript
type FilterMode = 'affected' | 'unaffected' | 'inProcess';
// For getAllPartners / getAllGoods
export interface GetAllItemsOptions {
take?: number;
skip?: number;
restrictedJournalId?: string | null; // User's top-level permission
// New Filtering Logic
filterMode?: FilterMode;
permissionRootId?: string; // The top-level journal of the current selection path
selectedJournalIds?: string[]; // The full path of selected journals
}
// For findPartnersForGoods / findGoodsForPartners
export interface IntersectionFindOptions {
partnerIds?: bigint[];
goodIds?: bigint[];
journalIds?: string[]; // Optional array for journal context
}
Function Details:
async getAllPartners(options: GetAllItemsOptions): Promise<{ data: Partner[], totalCount: number }>
Purpose: A comprehensive fetch function that handles initial population and filtering by Journal selection with various modes.
Implementation: The where clause is built dynamically based on options.filterMode:
'affected': Filters the link table for links to the last journal in the selectedJournalIds array. This relies on the business rule that items must be linked to parent journals first.
'unaffected': Performs a subquery to get all item IDs linked to the last journal in selectedJournalIds, then queries for items linked to any journal under permissionRootId whose IDs are notIn the subquery's result.
'inProcess': Uses a where clause of { approvalStatus: 'PENDING', linkTable: { some: { journalId: { in: selectedJournalIds } } } }.
No filterMode: Simply respects the restrictedJournalId for initial population.
Usage Example: The primary function for the Partner/Good slider when it appears after the Journal slider (J -> P -> ... or J -> G -> ...).
async findGoodsForPartners(options: IntersectionFindOptions): Promise<{ data: GoodsAndService[], totalCount: number }>
Purpose: Finds items that are common to ALL specified counterparts, optionally filtered by a set of journals.
Implementation: The core intersection logic (using groupBy and having count) is maintained. If journalIds is provided and is not empty, the initial query on the link table is modified to use where: { journalId: { in: journalIds } }.
Usage Example: Used in J -> P -> G (find goods for selected partners within selected journals) or P -> G (find goods common to selected partners, ignoring journal context).
src/app/services/documentService.ts
Purpose: Manages all queries and mutations for the Document and DocumentLine entities, leveraging denormalized schema fields for performance.
Functions:
async createDocument(data: CreateDocumentData, createdById: string, journalId: string, ...): Promise<Document & { lines: DocumentLine[] }>
async getAllDocuments(options: GetAllDocumentsOptions): Promise<{ data: Document[], totalCount: number }>
async getDocumentById(id: bigint): Promise<Document | null>
(...other CRUD functions like updateDocument, deleteDocument)
Type Definitions (src/lib/types/serviceOptions.ts):
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
IGNORE*WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Function Details:
async createDocument(...)
Purpose: Creates a new Document and its lines, populating the denormalized fields.
Implementation: The function accepts a journalId. When creating the Document record, it sets the journalId field. When creating DocumentLine records, it populates the denormalized goodId field on each line.
async getAllDocuments(options: GetAllDocumentsOptions): Promise<...>
Purpose: A powerful fetching function for the Document slider, capable of filtering by Journals, Partners, and Goods.
Implementation: Builds a dynamic Prisma.DocumentWhereInput clause.
filterByJournalIds adds journalId: { in: ... }.
filterByPartnerIds adds partnerId: { in: ... }.
filterByGoodIds adds a relational filter: lines: { some: { goodId: { in: ... } } }.
Always respects the user's restrictedJournalId by filtering on the top-level journal and its descendants.
Usage Example: The primary function for the Document slider in any permutation (J -> P -> D, G -> D, etc.).
async getDocumentById(id: bigint): Promise<Document | null>
Purpose: Fetches a single document, efficiently including its full good details.
Implementation: Uses an optimized include clause: include: { partner: true, lines: { include: { good: true } } }. This avoids N+1 queries on the frontend to get good details for each line.
Usage Example: Used in the "Gateway Lookup" mode (D -> P -> G) to display the contents of a selected document.
Linking Services (journalGoodLinkService, etc.)
Status: These services are low-level helpers.
Business Logic Enforcement: A critical responsibility of these services is to enforce the hierarchical linking rule. In journalPartnerLinkService.createLink and journalGoodLinkService.createLink, before creating a link to a child journal (e.g., 4001), the service MUST query the database to verify that a link for the same item already exists for the parent journal (40). If it does not, the function must throw an error. This guarantees data integrity.
API Layer Structure (src/app/api/...)
This section outlines the structure of the API routes that consume the service functions. The API layer acts as a thin, secure translator between HTTP requests and our robust service layer.
Core Principles
RESTful Design: Use standard HTTP methods (GET, POST, PUT, DELETE) on resource-based URLs (e.g., /api/partners).
Single Flexible Endpoint: Favor a single, powerful GET endpoint per resource that uses query parameters for filtering, rather than creating many specific endpoints.
Validation: All incoming request bodies and query parameters are rigorously validated using Zod schemas.
Authorization: Every route is wrapped with a Higher-Order Function (withAuthorization) to enforce permissions.
API Endpoint Specifications
Resource: Journals (GET /api/journals)
Purpose: Fetches journals based on various contexts.
Query Parameters:
rootJournalId: string (optional): Fetches the sub-hierarchy for a restricted user. Calls journalService.getJournalSubHierarchy.
findByPartnerIds: string (optional, comma-separated bigint): Finds journals linked to partners. Calls journalService.getJournalsForPartners.
findByGoodIds: string (optional, comma-separated bigint): Finds journals linked to goods. Calls journalService.getJournalsForGoods.
Logic: The route handler uses an if/else if/else block to determine which service function to call.
Resource: Partners (GET /api/partners)
Purpose: The single endpoint for fetching partners for all slider scenarios.
Query Parameters:
take, skip (for pagination).
filterMode, permissionRootId, selectedJournalIds (for journal-based filtering).
intersectionOfGoodIds: string (optional, comma-separated bigint): For finding partners common to a set of goods.
Logic: The handler checks if intersectionOfGoodIds is present. If so, it calls partnerService.findPartnersForGoods. Otherwise, it calls partnerService.getAllPartners.
Resource: Goods & Services (GET /api/goods)
Purpose: The single endpoint for fetching goods for all slider scenarios.
Logic: Symmetrical to the /api/partners endpoint. It checks for intersectionOfPartnerIds to call goodsService.findGoodsForPartners, otherwise calls goodsService.getAllGoods.
Resource: Documents
GET /api/documents: A powerful endpoint for fetching documents.
Query Parameters: take, skip, filterByJournalIds, filterByPartnerIds, filterByGoodIds.
Logic: Parses all filter parameters and calls documentService.getAllDocuments with all options.
GET /api/documents/[id]: Fetches a single, detailed document for the "Gateway Lookup" view by calling the documentService.getDocumentById(id).
CRUD Operations (Example: Partners)
POST /api/partners: Validates body against createPartnerSchema and calls partnerService.createPartner.
PUT /api/partners/[id]: Validates body against updatePartnerSchema and calls partnerService.updatePartner.
DELETE /api/partners/[id]: Calls partnerService.deletePartner.
Resources: Link Tables (journal-partner-links, journal-good-links, etc.)
File Location: Each link table has its own consolidated route file (e.g., src/app/api/journal-partner-links/route.ts).
Logic: Each file contains handlers for POST, GET, and DELETE.
POST: Creates a new link.
GET: Fetches links based on dynamic where clauses constructed from query parameters (e.g., linkId, journalId, partnerId).
DELETE: Deletes a link based on its primary key or a composite key provided in query parameters. Zod schemas enforce that valid deletion criteria are provided.
ERP Frontend Application: The Authoritative Developer Guide
Part I: General Application Documentation
Welcome to the team. This document is your complete guide to the application's architecture, conventions, and development patterns.
This is a sophisticated, client-side rendered web application (Next.js with a "use client" architecture) that serves as the primary user interface for our ERP system.
Core Concept: Chained Filtering
The application's heart is a dynamic, multi-slider interface. Users configure which business entities (Journals, Partners, Goods, etc.) are displayed as "sliders." A selection made in one slider dynamically filters the content of all subsequent sliders to its right. This "chained filtering" provides a powerful and intuitive way to explore complex data relationships.
Architectural Pillars
All development must strictly adhere to these four foundational patterns.
Pillar 1: Centralized Global State (Zustand)
Location: src/store/appStore.ts
Purpose: The single source of truth for minimal, truly global application state: user authentication, UI layout (slider order), and core entity selections that drive chained filtering.
Convention: Avoid bloating the global store. Feature-specific state belongs in a Manager Hook.
Pillar 2: Decentralized Logic (Headless "Manager" Hooks)
Location: src/features/[featureName]/use[FeatureName]Manager.ts
Purpose: Encapsulates all complex business logic, data fetching (via TanStack Query), and feature-specific state for a single feature.
Convention: A manager hook takes zero arguments. It consumes global state from the Zustand store and exposes all data, derived state, and handlers its feature needs.
Pillar 3: Controller Components (The Bridge)
Location: src/features/[featureName]/[FeatureName]Controller.tsx
Purpose: A non-visual or lightly-visual component that orchestrates a feature, connecting the headless logic from a Manager Hook to the presentational UI components (e.g., modals, sliders).
Convention: A Controller calls its Manager Hook, manages conditional rendering, and passes data and handlers down as props.
Pillar 4: Cross-Feature Communication (The "Switchboard" Model)
Location: src/app/page.tsx
Purpose: Manages direct interactions between features.
Convention: The page.tsx file acts as the central "switchboard." We use React.forwardRef on Controller Components to expose imperative methods (e.g., open()), which the page calls directly.
Architecture: Type Safety & Data Flow
To ensure robustness and prevent bugs, the application follows a strict, type-safe architecture.
Guiding Principles:
schema.prisma is the single source of truth for database models.
Zod schemas are the single source of truth for API payloads.
The API layer is responsible for translating between client-side types (e.g., id: string) and server-side types (e.g., id: bigint).
Key Directories:
src/lib/schemas/: Contains all Zod schemas used for validating API payloads on the server and form data on the client. Each entity has its own schema file (e.g., partner.schema.ts).
src/lib/types/models.client.ts: Contains definitions for our data models as they exist on the client. These types transform server-side models (e.g., converting bigint IDs to strings).
src/lib/types/ui.ts: Contains pure UI-state types that have no server equivalent (e.g., SliderType, DocumentCreationMode).
The Data Flow Pattern:
Schema Definition (src/lib/schemas/): Define a Zod schema for creating/updating an entity. This becomes the contract between the client and server.
Generated typescript
// src/lib/schemas/partner.schema.ts
import { z } from 'zod';
export const createPartnerSchema = z.object({
name: z.string().min(1, "Name is required"),
partnerType: z.enum(["LEGAL_ENTITY", "NATURAL_PERSON"]),
// ... other fields
});
export type CreatePartnerPayload = z.infer<typeof createPartnerSchema>;
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
API Route Validation: The API endpoint uses the schema to validate incoming data before passing it to the service layer.
Generated typescript
// src/app/api/partners/route.ts
const validation = createPartnerSchema.safeParse(await request.json());
if (!validation.success) { /* return 400 \_/ }
await partnerService.createPartner(validation.data, ...);
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Client-Side Model Definition (src/lib/types/models.client.ts): Define the shape of data as the UI will use it.
Generated typescript
// src/lib/types/models.client.ts
import { Partner as PartnerPrisma } from "@prisma/client";
type WithStringId<T extends { id: bigint }> = Omit<T, 'id'> & { id: string };
export type PartnerClient = WithStringId<PartnerPrisma>;
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Client-Side Form: UI forms use the Zod schema for type-safe state and validation, typically with a library like react-hook-form.
Generated tsx
// Example with react-hook-form
import { createPartnerSchema, CreatePartnerPayload } from '@/lib/schemas/partner.schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
const { register, handleSubmit } = useForm<CreatePartnerPayload>({
resolver: zodResolver(createPartnerSchema)
});
const onSubmit = async (data: CreatePartnerPayload) => {
// 'data' is fully typed and validated
await clientPartnerService.create(data);
};
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Tsx
IGNORE_WHEN_COPYING_END
Client Service (src/services/client...): The client service fetches data from the API and maps it to the appropriate ...Client type, handling any necessary transformations like bigint to string.
This end-to-end type-safe approach minimizes runtime errors and ensures that changes in the database schema or API contract are caught by the type system during development.
Part II: Feature Documentation
Feature: Hierarchical Journal Filtering
This document details the interaction logic for the hierarchical Journal selection interface.
Core Interface Components:
Split Button Control: A master control at the top of the Journal slider.
Main Context Display: Shows the current hierarchy level (e.g., ROOT - All Accounts). Double-click to navigate up one level.
Dropdown Trigger (▼): Opens a menu of explicit actions (Restore Last Selection, Select All Visible, etc.).
L1 Items (1st Row): The top-level journal items in the current view, displayed in a horizontal scroller.
L2 Items (2nd Row): Children of an expanded L1 parent, displayed in a wrapping grid.
State Persistence and Memory:
Persistent Top-Level Saved State: For each top-level view (e.g., ROOT), the system can store one snapshot of a custom selection, created by manually clicking an L1 or L2 item.
L1-Item Saved State: A snapshot of selected L2 children for a specific L1 parent, used for the "Restore" action in the L1 item's click cycle.
Interaction Logic:
General Principles
Manual Selection Priority: Any manual click on an L1 or L2 item creates a "custom saved state."
Navigation: Double-clicking an item with children drills down. Double-clicking the main context display navigates up.
Terminal Nodes: A single click on an item with no children toggles its selection state.
Top-Level Control Button Interaction
Dropdown Menu Actions:
Restore Last Selection: Restores the saved custom selection for the current view.
Select All Visible: Expands all L1 parents and selects every visible L1 and L2 item.
Select Parents Only: Expands and selects all L1 parents, deselecting their L2 children.
Clear All Selections: Deselects all items in the view (does not clear the persistent saved state).
Using any top-level action resets the internal click-cycle state of all L1 items.
L1 Item Interaction (for items with children)
Double Click: Navigates into that item.
Single-Click Cycle: A single click cycles through these states:
Restore Saved Selection (if a custom L2 selection was saved for it).
Children Visible, All Selected.
Children Visible, Parent Selected.
Children Hidden, Parent Selected.
Unselected.
L2 Item Interaction
Single Click: Toggles the selection of the L2 item. This updates both the L1-item's saved state and the top-level saved state.
Double Click: Navigates up to the parent of the L2 item and selects only the L2 item that was double-clicked.
