# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build and Start:**
- `npm run dev` - Start development server
- `npm run build` - Build production (includes Prisma generation)
- `npm run serve` - Build and start production server
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

**Database:**
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate:deploy` - Deploy migrations

## Architecture Overview

This is a Next.js ERP application with PostgreSQL database via Prisma ORM. The core feature is a dynamic "slider" interface where users can reorder business entity sliders (Journal, Partner, Goods, Document, Project) to create different data filtering workflows.

### Key Technologies
- **Frontend:** Next.js 15.2.4, React 19, Zustand (state), TanStack Query (data fetching)
- **Backend:** Next.js API routes with Prisma ORM
- **Auth:** NextAuth.js with credentials provider
- **Database:** PostgreSQL with comprehensive audit trails and soft deletion
- **Styling:** CSS Modules with Framer Motion animations

### Core Architecture Concepts

**1. Dynamic Slider System:**
The application's main interface orchestrates various "sliders" representing business entities. The `sliderOrder` in global state determines both UI layout and data flow dependencies. Each slider fetches data filtered by selections made in preceding sliders.

**2. Dual Operating Modes:**
- **Standard Mode** (`isCreating: false`): Data exploration/browsing
- **Document Creation Mode** (`isCreating: true`): Guided workflow for creating documents

**3. State Management (`src/store/appStore.ts`):**
- `auth` - User authentication and journal restrictions
- `ui` - Controls `sliderOrder`, visibility, and `isCreating` mode
- `selections` - Currently selected entities (e.g., `selectedJournalId`)
- `documentCreationState` - Manages locked entities and document items during creation

**4. Data Fetching (`src/hooks/useChainedQuery.ts`):**
Centralized query management that constructs different queries based on slider type, position in `sliderOrder`, and current mode. Implements chained dependencies where each slider is filtered by preceding selections.

### Business Entity Models

**Core Entities:**
- **Journal**: Hierarchical account structure with terminal/non-terminal nodes
- **Partner**: Legal entities or natural persons with approval workflows
- **GoodsAndService**: Products/services with tax codes and units of measure
- **Document**: Invoices, quotes, purchase orders with line items
- **DocumentLine**: Individual line items linking documents to journal-partner-good relationships

**Linking Tables:**
- `JournalPartnerLink` - Associates partners with journals (with partnership types)
- `JournalGoodLink` - Associates goods with journals (with hierarchical enforcement)
- `JournalPartnerGoodLink` - Three-way association for pricing/availability context

### Journal Filtering System

The Journal slider supports three filter modes affecting subsequent sliders:
- **`affected`**: Returns entities linked to selected journal hierarchy (strict hierarchical filter)
- **`unaffected`**: Returns entities linked to parent path but NOT to deepest selected journal (exclusion filter)
- **`inProcess`**: Same as `affected` but only entities with PENDING status

### Authentication & Authorization

Uses NextAuth.js with role-based permissions. Each user can have a `restrictedTopLevelJournalId` that limits their data access to a specific journal hierarchy branch.

**Permission Structure:**
- Users have roles via `UserRole` junction table
- Roles have permissions via `RolePermission` junction table
- Permissions follow action/resource pattern (e.g., "CREATE_PARTNER" on "PARTNER")

### Database Patterns

**Audit Trail:** All major entities include:
- `entityState` (ACTIVE/MODIFIED/DELETED)
- `approvalStatus` (PENDING/APPROVED/REJECTED) 
- `createdById`, `createdByIp`, `deletedById`, `deletedByIp`
- `previousVersionId`, `nextVersionId` for version chains

**Soft Deletion:** Entities are marked as DELETED rather than physically removed.

### Key Directories

- `src/app/api/` - Next.js API routes
- `src/app/services/` - Server-side business logic services
- `src/services/` - Client-side service wrappers
- `src/features/` - Feature-specific UI components and hooks
- `src/lib/schemas/` - Zod validation schemas
- `src/lib/auth/` - Authentication configuration and utilities
- `docs/` - Architecture and API documentation

### Service Layer Pattern

Each entity has paired services:
- Server-side service in `src/app/services/` (e.g., `journalService.ts`)
- Client-side service in `src/services/` (e.g., `clientJournalService.ts`)

Server services handle database operations and business logic. Client services provide React Query-compatible API calls.

### Important Business Rules

1. **Hierarchical Journal Linking**: Goods cannot be linked to child journals unless already linked to parent journals
2. **Document Creation Workflows**: The position of Document slider in `sliderOrder` determines whether single or multiple documents are created and what entities get "locked"
3. **User Journal Restrictions**: Users can be restricted to specific journal hierarchy branches
4. **Approval Workflows**: Partners and Goods require approval before being marked as ACTIVE

### Development Notes

- Database schema is in `prisma/schema.prisma`
- Seeding script at `prisma/seed.ts`
- CSS Modules used throughout for styling
- All components follow feature-based organization
- Extensive use of TypeScript with Zod for validation