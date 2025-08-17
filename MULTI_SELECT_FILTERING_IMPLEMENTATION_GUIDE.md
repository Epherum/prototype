# Multi-Select Filtering Implementation Guide

## Overview

This document provides a comprehensive guide for implementing multi-select filtering in the ERP application's dynamic slider system. Currently, the system supports single-select filtering where selecting a new filter deselects the previous one. This guide outlines the changes needed to support multiple concurrent filters.

## Current System Architecture

### 1. State Management (Single-Select)

**Location**: `src/store/slices/selectionsSlice.ts:90-98`

Current implementation only allows one active filter:
```typescript
if (sliderType === "journal.rootFilter") {
  // Single-select only: if clicking the same filter, deselect it; otherwise select the new one
  const currentFilter = newSelections.journal.rootFilter[0];
  if (currentFilter === value) {
    newSelections.journal.rootFilter = [];
  } else {
    newSelections.journal.rootFilter = [value];
  }
  clearSubsequent = false;
}
```

**State Structure**: 
- `rootFilter: string[]` - Array but used as single-select
- Three filter modes: `["affected", "unaffected", "inProcess"]`

### 2. Query Logic (Single-Select Aware)

**Location**: `src/hooks/useChainedQuery.ts:207-226`

Current implementation uses first filter only:
```typescript
// Handle multiple filter modes - for now, use the first one but ensure all are included in query key
const activeFilters = journalSelection.rootFilter;
const primaryFilterMode = activeFilters[0];

// Include all filters in params to ensure query key changes when filters change
params.allFilters = activeFilters;
```

### 3. Service Layer (Single Filter Mode)

**Location**: `src/app/services/partnerService.ts:86-182`

Current service processes one filter mode at a time:
- **affected**: Partners linked to selected journals (APPROVED status)
- **unaffected**: Partners linked to parent paths but NOT to deepest journals (APPROVED status)  
- **inProcess**: Partners linked to selected journals (PENDING status)

### 4. Database Schema (Multi-Select Ready)

The database schema already supports multi-select filtering through the linking tables:
- `JournalPartnerLink` - Links partners to journals with partnership types
- `JournalGoodLink` - Links goods to journals
- `JournalPartnerGoodLink` - Three-way relationships for pricing/availability

## Implementation Changes Required

### Phase 1: State Management Updates

#### 1.1 Update Selection Logic
**File**: `src/store/slices/selectionsSlice.ts`

```typescript
if (sliderType === "journal.rootFilter") {
  // Multi-select: toggle the filter on/off
  const currentFilters = new Set(newSelections.journal.rootFilter);
  if (currentFilters.has(value)) {
    currentFilters.delete(value);
  } else {
    currentFilters.add(value);
  }
  newSelections.journal.rootFilter = Array.from(currentFilters);
  clearSubsequent = false;
}
```

#### 1.2 Update Type Definitions
**File**: `src/store/types.ts`

No changes needed - `rootFilter: string[]` already supports arrays.

### Phase 2: Query Layer Updates

#### 2.1 Update Query Parameter Handling
**File**: `src/hooks/useChainedQuery.ts`

```typescript
// Handle multiple active filter modes
const activeFilters = journalSelection.rootFilter;

if (hasJournalSelections && isJournalBeforePartner) {
  const terminalIds = journalSelection.level3Ids.length > 0 
    ? journalSelection.level3Ids
    : journalSelection.level2Ids.length > 0 
      ? journalSelection.level2Ids
      : journalSelection.topLevelId ? [journalSelection.topLevelId] : [];
      
  params.selectedJournalIds = terminalIds;
  params.activeFilterModes = activeFilters; // Pass all active filters
  params.permissionRootId = journalSelection.topLevelId;
}
```

#### 2.2 Update API Parameter Schemas
**File**: `src/lib/schemas/partner.schema.ts`

```typescript
export const getPartnersQuerySchema = z.object({
  // ... existing fields
  filterMode: z.enum(["affected", "unaffected", "inProcess"]).optional(),
  activeFilterModes: z.array(z.enum(["affected", "unaffected", "inProcess"])).optional(),
  // ... rest of schema
});
```

**File**: `src/lib/schemas/good.schema.ts` (similar updates)

### Phase 3: Service Layer Updates

#### 3.1 Partner Service Multi-Filter Logic
**File**: `src/app/services/partnerService.ts`

```typescript
async getAllPartners(
  options: GetAllItemsOptions<Prisma.PartnerWhereInput>
): Promise<{ data: Partner[]; totalCount: number }> {
  const {
    take,
    skip,
    restrictedJournalId,
    filterMode, // Keep for backward compatibility
    activeFilterModes, // New multi-select array
    permissionRootId,
    selectedJournalIds = [],
    where: externalWhere,
  } = options;

  // Use activeFilterModes if provided, otherwise fall back to single filterMode
  const filtersToApply = activeFilterModes?.length > 0 
    ? activeFilterModes 
    : filterMode ? [filterMode] : [];

  if (filtersToApply.length > 0) {
    const filterClauses = await this.buildMultiFilterClauses(
      filtersToApply,
      selectedJournalIds,
      permissionRootId
    );
    
    // Combine filter clauses with OR logic
    prismaWhere.AND = [
      ...filterClauses.length > 1 
        ? [{ OR: filterClauses }]
        : filterClauses
    ];
  }
  
  // ... rest of method
}

private async buildMultiFilterClauses(
  filterModes: string[],
  selectedJournalIds: string[],
  permissionRootId?: string
): Promise<Prisma.PartnerWhereInput[]> {
  const clauses: Prisma.PartnerWhereInput[] = [];
  
  for (const mode of filterModes) {
    switch (mode) {
      case "affected":
        clauses.push({
          AND: [
            { approvalStatus: "APPROVED" },
            {
              journalPartnerLinks: {
                some: { journalId: { in: selectedJournalIds } },
              },
            },
          ],
        });
        break;
        
      case "unaffected":
        if (!permissionRootId) continue;
        
        // Get parent paths logic (similar to existing)
        const parentPaths = await this.getParentPathsForJournals(selectedJournalIds);
        const affectedPartnerIds = await this.getAffectedPartnerIds(selectedJournalIds);
        
        clauses.push({
          AND: [
            { approvalStatus: "APPROVED" },
            {
              journalPartnerLinks: {
                some: { journalId: { in: parentPaths } },
              },
            },
            { id: { notIn: affectedPartnerIds } },
          ],
        });
        break;
        
      case "inProcess":
        clauses.push({
          AND: [
            { approvalStatus: "PENDING" },
            {
              journalPartnerLinks: {
                some: { journalId: { in: selectedJournalIds } },
              },
            },
          ],
        });
        break;
    }
  }
  
  return clauses;
}
```

#### 3.2 Goods Service Multi-Filter Logic
**File**: `src/app/services/goodsService.ts`

Similar multi-filter implementation needed for goods service with appropriate business logic.

### Phase 4: API Layer Updates

#### 4.1 Update API Routes
**File**: `src/app/api/partners/route.ts`

```typescript
export const GET = withAuthorization(
  async function GET(request: NextRequest, _context, session: ExtendedSession) {
    // ... existing validation
    
    const { 
      intersectionOfGoodIds, 
      findByDocumentId, 
      selectedJournalIds, 
      filterMode,
      activeFilterModes, // New parameter
      permissionRootId, 
      ...restOfOptions 
    } = validation.data;
    
    // ... rest of implementation with activeFilterModes support
  }
);
```

### Phase 5: UI Component Updates

#### 5.1 Filter Button Logic
**File**: `src/features/journals/components/JournalHierarchySlider.tsx`

Update filter buttons to show multi-select state:

```typescript
const FilterButton = ({ 
  mode, 
  activeFilters, 
  onToggle 
}: { 
  mode: string; 
  activeFilters: string[]; 
  onToggle: (mode: string) => void;
}) => {
  const isActive = activeFilters.includes(mode);
  
  return (
    <button 
      className={`${styles.filterButton} ${isActive ? styles.activeFilter : ''}`}
      onClick={() => onToggle(mode)}
    >
      {mode}
      {isActive && <span className={styles.activeIndicator}>✓</span>}
    </button>
  );
};
```

#### 5.2 Visual Indicators
Update CSS to show multi-select state:

```css
.filterButton.activeFilter {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  position: relative;
}

.activeIndicator {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #4CAF50;
}

.multiSelectActive {
  border: 2px solid #4CAF50;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
}
```

## Business Logic Considerations

### Filter Combination Logic

When multiple filters are active, the system should use OR logic:
- **affected OR unaffected**: Show both approved partners linked to selected journals AND approved partners linked to parent paths but not deepest journals
- **affected OR inProcess**: Show both approved AND pending partners linked to selected journals
- **unaffected OR inProcess**: Show approved partners from parent paths (excluding affected) AND pending partners from selected journals

### Performance Considerations

1. **Query Optimization**: Multi-filter queries may be more complex. Consider:
   - Database indexing on `journalId`, `partnerId`, `approvalStatus`
   - Query result caching for common filter combinations
   - Pagination optimization for large result sets

2. **Memory Usage**: Larger result sets with multi-select may impact frontend performance
   - Implement virtual scrolling for large lists
   - Consider server-side filtering vs client-side filtering trade-offs

3. **Cache Invalidation**: Multi-select increases cache key complexity
   - Ensure query keys properly serialize all active filters
   - Consider cache size limits with increased key combinations

## Migration Strategy

### Phase 1: Backend Changes (Non-Breaking)
1. Update service layer to support both single and multi-filter modes
2. Update API schemas to accept both `filterMode` and `activeFilterModes`
3. Maintain backward compatibility with existing single-filter usage

### Phase 2: Frontend State Updates
1. Update state management to support multi-select
2. Update query hooks to pass multi-filter parameters
3. Ensure proper cache key generation

### Phase 3: UI Updates
1. Update filter buttons to support multi-select
2. Add visual indicators for active filters
3. Update user interaction patterns

### Phase 4: Testing & Optimization
1. Test all filter combinations
2. Performance testing with large datasets
3. User acceptance testing for new interaction patterns

## Testing Requirements

### Unit Tests
- State management multi-select logic
- Service layer filter combination logic
- Query parameter validation

### Integration Tests
- API endpoints with multi-filter parameters
- Database query performance with OR conditions
- Cache behavior with multi-select keys

### E2E Tests
- Multi-filter selection workflows
- Filter combination result accuracy
- Performance with large datasets

## Backward Compatibility

The implementation maintains backward compatibility by:
1. Keeping existing `filterMode` parameter support
2. Defaulting to single-select behavior when `activeFilterModes` not provided
3. Preserving existing API contracts while extending functionality

## Future Considerations

1. **Filter Presets**: Allow users to save common filter combinations
2. **Advanced Filtering**: Add date ranges, custom criteria, etc.
3. **Filter Analytics**: Track usage patterns for optimization
4. **Export Functionality**: Export filtered results to various formats

## Critical Implementation Notes

1. **Query Key Management**: Ensure `useChainedQuery` properly serializes all active filters in query keys to prevent stale data
2. **State Persistence**: Update localStorage saving/loading for multi-select filter state
3. **Error Handling**: Handle cases where filter combinations return empty results
4. **Loading States**: Manage loading indicators for complex multi-filter queries
5. **Performance Monitoring**: Track query performance with multi-filter combinations

This implementation will significantly enhance the application's filtering capabilities while maintaining the existing architecture's integrity and performance characteristics.