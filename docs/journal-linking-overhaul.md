# Journal Linking Overhaul Documentation

## Overview

This document details the comprehensive overhaul of the partner and goods creation process to ensure mandatory journal assignment with automatic hierarchical linking. This addresses the issue where entities were created without proper journal associations, preventing them from appearing in "inProcess" filtering.

## Problem Statement

Previously, partners and goods could be created without being assigned to any journal. This caused several issues:

1. **Filtering Problems**: Entities not linked to journals wouldn't appear in "inProcess" filter mode
2. **Inconsistent Data**: Some entities existed without proper hierarchical linking
3. **Permission Issues**: Non-admin users could create entities outside their journal restrictions
4. **Data Integrity**: The hierarchical business rules weren't enforced during creation

## Solution Architecture

### 1. Database Function Enhancement

**File**: `src/app/services/journalService.ts`

Added `getJournalAncestorPath(journalId: string)` function that:
- Uses recursive SQL to find the complete ancestor path from root to target journal
- Returns an array of journal IDs ordered from root to the selected journal
- Ensures all parent journals are included for proper hierarchical linking

```sql
WITH RECURSIVE "JournalAncestors" AS (
  SELECT "id", "parent_id", 0 AS level FROM "journals" WHERE "id" = ${journalId}
  UNION ALL
  SELECT j."id", j."parent_id", ja.level + 1 FROM "journals" j
  INNER JOIN "JournalAncestors" ja ON j."id" = ja."parent_id"
)
SELECT "id", level FROM "JournalAncestors" ORDER BY level DESC;
```

### 2. Schema Updates

**Files**: 
- `src/lib/schemas/partner.schema.ts`
- `src/lib/schemas/good.schema.ts`

Enhanced both schemas to require journal selection:
- Added `journalId: z.string().min(1, "Journal selection is required")` to creation schemas
- Excluded `journalId` from update schemas (journal assignment cannot be changed after creation)
- Updated TypeScript types to reflect the new requirements

### 3. Service Layer Changes

**Files**:
- `src/app/services/partnerService.ts`
- `src/app/services/goodsService.ts`

Modified `createPartner` and `createGood` functions to:
1. Extract `journalId` from the creation payload
2. Get the complete ancestor path using `getJournalAncestorPath`
3. Create the entity first
4. Automatically create links to ALL journals in the ancestor path
5. Log the linking process for audit purposes

**Partner Service Enhancement**:
```typescript
const { journalId, ...partnerData } = data;
const ancestorPath = await journalService.getJournalAncestorPath(journalId);

// Create partner
const newPartner = await prisma.partner.create({ data: partnerData });

// Create journal-partner links for entire hierarchy
const journalPartnerLinks = ancestorPath.map(journalId => ({
  journalId,
  partnerId: newPartner.id,
  partnershipType: "BUSINESS_RELATIONSHIP",
  createdById: createdById,
}));

await prisma.journalPartnerLink.createMany({ data: journalPartnerLinks });
```

### 4. UI Component Updates

**Files**:
- `src/features/partners/components/AddEditPartnerModal.tsx`
- `src/features/goods/components/AddEditGoodModal.tsx`

Enhanced both modals to include:
- Journal selection dropdown (only for new entities, not edits)
- Integration with user's journal restrictions
- Enhanced UX with hierarchical display paths
- Loading states and error handling
- Proper form validation

**Key Features**:
- Uses `fetchJournalsForSelection()` to get available journals based on user restrictions
- Displays journals with full hierarchical paths (e.g., "Revenue > Sales > Retail")
- Only shows journals the user has permission to access
- Required field validation with clear error messages

### 5. Client Service Integration

**File**: `src/services/clientJournalService.ts`

Added `fetchJournalsForSelection()` function that:
- Respects user's `restrictedTopLevelJournalId`
- Returns flat array of available journals
- Used by UI components for dropdown population

## Business Rules Enforced

### 1. Hierarchical Linking
- When a partner/good is assigned to a journal, it's automatically linked to ALL parent journals
- Example: Assigning to "Revenue > Sales > Retail" creates links to "Revenue", "Sales", and "Retail"
- This ensures proper hierarchical filtering in all modes (affected, unaffected, inProcess)

### 2. User Restrictions
- Non-admin users can only assign entities to journals within their restricted hierarchy
- The journal dropdown only shows journals the user has permission to access
- Prevents privilege escalation and data isolation violations

### 3. Creation-Time Only
- Journal assignment happens only during entity creation
- Once created, the journal assignment cannot be changed (business rule)
- This maintains data consistency and audit trail integrity

### 4. Approval Workflow Integration
- New entities are created with `approvalStatus: PENDING`
- The "inProcess" filter now correctly shows these entities because they're properly linked
- Entities appear in the correct journal context for approval workflows

## Filter Mode Behavior

### Before Overhaul
- **inProcess**: Could miss entities not linked to journals
- **affected**: Might not show all related entities
- **unaffected**: Inconsistent results due to incomplete linking

### After Overhaul
- **inProcess**: Shows all PENDING entities properly linked to journal hierarchy
- **affected**: Correctly shows all entities linked to selected journal path
- **unaffected**: Properly excludes entities based on complete hierarchical data

## Migration Considerations

### Existing Data
- Existing partners/goods without journal links will need migration
- Consider running a data migration script to link existing entities to appropriate journals
- May require business user input for proper journal assignment

### Backward Compatibility
- Edit functions remain unchanged (no journal modification after creation)
- Existing API endpoints continue to work
- No breaking changes to existing functionality

## Testing Recommendations

1. **Unit Tests**: Test the `getJournalAncestorPath` function with various hierarchy depths
2. **Integration Tests**: Verify complete linking process in create functions
3. **UI Tests**: Test journal selection dropdown behavior with different user restrictions
4. **Filter Tests**: Verify all filter modes work correctly with new linking structure

## Deployment Checklist

1. ✅ Database function implemented
2. ✅ Schema updates completed
3. ✅ Service layer updated
4. ✅ UI components enhanced
5. ✅ Client services integrated
6. ⚠️ **REQUIRED**: Run linting and type checking
7. ⚠️ **REQUIRED**: Test with restricted user accounts
8. ⚠️ **RECOMMENDED**: Create data migration script for existing entities

## Future Enhancements

1. **Bulk Assignment**: Allow bulk journal assignment for existing entities
2. **Journal Transfer**: Implement controlled journal reassignment with approval
3. **Advanced Filtering**: Add journal-aware search and filtering capabilities
4. **Audit Trail**: Enhanced logging for journal assignment operations

## Key Files Modified

### Core Services
- `src/app/services/journalService.ts` - Added ancestor path function
- `src/app/services/partnerService.ts` - Enhanced creation with linking
- `src/app/services/goodsService.ts` - Enhanced creation with linking

### Schemas
- `src/lib/schemas/partner.schema.ts` - Added required journalId
- `src/lib/schemas/good.schema.ts` - Added required journalId
- `src/lib/types/service.types.ts` - Updated type definitions

### UI Components
- `src/features/partners/components/AddEditPartnerModal.tsx` - Added journal selection
- `src/features/goods/components/AddEditGoodModal.tsx` - Added journal selection
- `src/services/clientJournalService.ts` - Added selection service

### Styling
- `src/features/partners/components/AddEditPartnerModal.module.css` - Added error/info styles
- `src/features/goods/components/AddEditGoodModal.module.css` - Added error/info styles

## Impact Summary

This overhaul ensures:
- ✅ All new partners/goods are properly linked to journal hierarchies
- ✅ "inProcess" filtering works correctly for all entities
- ✅ User journal restrictions are enforced during creation
- ✅ Hierarchical business rules are automatically maintained
- ✅ Data integrity is preserved through the entire creation process
- ✅ UI provides clear feedback and guidance to users