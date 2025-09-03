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

This is a Next.js ERP application with PostgreSQL database via Prisma ORM. The core innovation is a revolutionary dynamic "slider" interface where users can reorder business entity sliders (Journal, Partner, Goods, Document, Project) to create completely different data filtering workflows and business processes.

### Key Technologies
- **Frontend:** Next.js 15.2.4, React 19, Zustand (modular state), TanStack Query (data fetching)
- **Backend:** Next.js API routes with comprehensive Prisma ORM integration
- **Auth:** NextAuth.js with sophisticated role-based permissions
- **Database:** PostgreSQL with comprehensive audit trails, soft deletion, and approval workflows
- **Styling:** CSS Modules with Framer Motion animations
- **UI:** Custom component system with Swiper.js for advanced slider interactions

### Core Architecture Concepts

**1. Revolutionary Dynamic Slider System:**
The application's main interface orchestrates various "sliders" representing business entities. The `sliderOrder` in global state determines both UI layout and data flow dependencies. Each slider dynamically fetches data filtered by selections made in preceding sliders, creating infinite workflow possibilities.

Examples of slider configurations:
- `Journal → Partner → Goods → Document` (Standard business workflow)
- `Document → Journal → Partner → Goods` (Document-first creation workflow)
- `Partner → Goods → Journal → Document` (Partner-focused workflow)

**2. Dual Operating Modes:**
- **Standard Mode** (`isCreating: false`): Data exploration, browsing, and management
- **Document Creation Mode** (`isCreating: true`): Guided workflow for creating documents with entity locking

**3. Advanced State Management (`src/store/appStore.ts`):**
Modular Zustand architecture with separate slices:
- `auth` - User authentication and journal restrictions
- `ui` - Controls `sliderOrder`, visibility, `isCreating` mode, theme
- `selections` - Currently selected entities across all sliders
- `documentCreationState` - Manages locked entities and document items during creation

**4. Intelligent Data Fetching (`src/hooks/useChainedQuery.ts`):**
Sophisticated query management system that:
- Constructs different queries based on slider type and position in `sliderOrder`
- Implements chained dependencies where each slider is filtered by preceding selections
- Optimizes performance with strategic caching and stale times
- Mode-aware queries that change behavior based on standard vs creation modes

### Business Entity Models and Advanced Relationships

**Core Entities:**
- **Journal**: Hierarchical account structure with unlimited depth, terminal/non-terminal nodes
- **Partner**: Legal entities and natural persons with comprehensive approval workflows
- **GoodsAndService**: Products/services with tax codes, units of measure, and barcode support
- **Document**: Invoices, quotes, purchase orders, credit notes with line items
- **DocumentLine**: Individual line items linking documents to journal-partner-good relationships

**Advanced Linking System:**
- `JournalPartnerLink` - Associates partners with journals (with partnership types like CONSIGNMENT, EXCLUSIVE_SUPPLIER)
- `JournalGoodLink` - Associates goods with journals (with strict hierarchical enforcement)
- `JournalPartnerGoodLink` - Three-way association for pricing/availability context

**Status System:**
- Flexible `Status` model for custom status management across entities
- Database-driven status configuration with colors and display ordering

### Hierarchical Approval System (NEW FEATURE)

**Core Architecture:**
- **Approval Direction**: Always flows from Root Level → Creation Level
- **Status Format**: `pending[creationLevel, currentPendingLevel]`
- **Sequential Processing**: No levels can be skipped in approval chain

**Key Components:**
- **ApprovalCenter** (`src/features/journals/components/ApprovalCenter.tsx`): Nested slider within Journal slider for approval management
- **Multi-Entity Filtering**: Support for Partner, Good, Link, Document approval types
- **Visual Progress Indicators**: Clear progress visualization for approval chains

**Database Schema Extensions:**
All core entities now include:
```sql
approvalStatus ApprovalStatus DEFAULT 'PENDING'
creationLevel INTEGER (for linked entities)
currentPendingLevel INTEGER DEFAULT 0
approvalHistory JSONB
```

**Business Rules:**
1. Users can only approve entities at their exact restriction level
2. Visibility: Users see ALL pending entities for oversight
3. Authority: Users can only approve items at their approval level
4. Sequential approval: Root → L1 → L2 → ... → Creation Level

### Journal Filtering System

The Journal slider supports three sophisticated filter modes:
- **`affected`**: Returns entities linked to selected journal hierarchy (strict hierarchical filter)
- **`unaffected`**: Returns entities linked to parent path but NOT to deepest selected journal (exclusion filter)
- **`inProcess`**: Same as `affected` but only entities with PENDING approval status (NEW)

### Authentication & Authorization

Comprehensive NextAuth.js implementation with:
- **Role-Based Permissions**: Granular permission system
- **Journal Restrictions**: Users restricted to specific journal hierarchy branches
- **Approval Level Authorization**: User approval level based on journal restrictions

**Permission Structure:**
- Users have roles via `UserRole` junction table
- Roles have permissions via `RolePermission` junction table  
- Permissions follow action/resource pattern (e.g., "CREATE_PARTNER" on "PARTNER")
- Approval authorization based on `restrictedTopLevelJournalId`

### Advanced Database Patterns

**Comprehensive Audit Trail:**
All major entities include:
- `entityState` (ACTIVE/MODIFIED/DELETED)
- `approvalStatus` (PENDING/APPROVED/REJECTED)
- `createdById`, `createdByIp`, `deletedById`, `deletedByIp`
- `previousVersionId`, `nextVersionId` for complete version chains
- `approvalHistory` JSONB for detailed approval metadata

**Soft Deletion with State Management:**
- Entities marked as DELETED rather than physically removed
- Complete audit trail preservation
- Version chain integrity maintained

**System Configuration:**
- `SystemSetting` model for flexible, database-driven configuration
- JSON value storage for complex configuration objects

### Key Directories and Architecture

**Core Structure:**
- `src/app/api/` - Next.js API routes with comprehensive error handling
- `src/app/services/` - Server-side business logic services (journalService, approvalService, etc.)
- `src/services/` - Client-side service wrappers with React Query integration
- `src/features/` - Feature-specific UI components organized by domain
- `src/features/shared/` - Reusable UI components
- `src/store/` - Modular Zustand state management
- `src/lib/schemas/` - Zod validation schemas
- `src/lib/auth/` - Authentication configuration and utilities
- `docs/` - Comprehensive architecture and API documentation

### Service Layer Pattern

**Paired Service Architecture:**
Each entity maintains two service layers:
- **Server-side** (`src/app/services/`): Database operations, business logic, authorization
- **Client-side** (`src/services/`): React Query-compatible API calls, caching strategies

**New Approval Services:**
- `approvalService.ts` - Server-side approval workflow management
- `clientApprovalService.ts` - Client-side approval operations with React Query keys

### Critical Business Rules and Workflows

1. **Hierarchical Journal Linking**: Goods cannot be linked to child journals unless already linked to parent journals (maintains organizational integrity)

2. **Document Creation Workflows**: The position of Document slider in `sliderOrder` fundamentally changes:
   - Whether single or multiple documents are created
   - What entities get "locked" during creation process
   - The sequence of user interactions

3. **User Journal Restrictions**: Users restricted to specific journal hierarchy branches for:
   - Data access control at organizational level
   - Permission scoping based on hierarchical position
   - Approval authority limitations

4. **Approval Workflows** (NEW): 
   - All Partners, Goods, Documents, and Links require hierarchical approval
   - Sequential approval cannot be bypassed or reversed
   - Complete audit trail of approval chain
   - User approval authority based on journal restrictions

5. **Slider Order Dependencies**: The order of sliders completely changes:
   - Data filtering logic
   - Available actions and operations
   - User workflow experience
   - Document creation behavior

### Advanced UI Features

**Slider Controllers:**
Each entity type has sophisticated controllers:
- `JournalSliderController.tsx` - Complex hierarchical journal selection with filter modes
- `PartnerSliderController.tsx` - Partner management with approval status indicators
- `GoodsSliderController.tsx` - Product catalog with hierarchical linking
- `DocumentSliderController.tsx` - Document creation with context-aware workflows
- `ApprovalCenter.tsx` - Nested approval management interface (NEW)

**UI Innovations:**
- **Quick Jump Menu**: Fast navigation within large datasets
- **Multi-Select Support**: For complex document creation workflows
- **Visual Status Indicators**: Color-coded status and approval level badges
- **Accordion Details**: Expandable detail views with related entity information
- **Progress Visualization**: Approval chain progress with dot indicators
- **Filter Pills**: Multi-select entity type filtering with count badges

### Performance Optimizations

**Query Strategy:**
- **Strategic Stale Times**: Different cache durations based on data volatility
- **Intelligent Query Enabling**: Queries only execute when dependencies are satisfied
- **Background Refetching**: Automatic data freshness for critical operations
- **Query Invalidation**: Strategic cache invalidation for approval workflows

**State Management:**
- **Selective Persistence**: User preferences persisted, sensitive data ephemeral
- **Memoized Selectors**: Optimized state access patterns
- **Modular Store Architecture**: Reduced bundle size through targeted imports

### Development Notes and Conventions

**Code Organization:**
- Database schema: `prisma/schema.prisma` (comprehensive with approval extensions)
- Seeding: `prisma/seed.ts` with approval test data
- Styling: CSS Modules throughout with consistent naming
- Components: Feature-based organization with shared components
- TypeScript: Extensive type safety with Zod validation schemas

**Development Patterns:**
- **Error Boundaries**: Comprehensive error handling at component level
- **Loading States**: Consistent loading UX across all operations
- **Optimistic Updates**: Immediate UI feedback with rollback capability
- **Accessibility**: ARIA labels and keyboard navigation support

**Testing Strategy:**
- Component testing with approval workflow scenarios
- API endpoint testing with authorization verification
- Integration testing for slider order dependencies
- Database constraint testing for approval chains

This ERP system represents a revolutionary approach to business management software with its dynamic slider interface, comprehensive approval workflows, and flexible architectural patterns. The recent addition of the hierarchical approval system adds enterprise-grade workflow management capabilities while maintaining the system's core flexibility and user experience innovations.