# Document Slider Filtering Issue

## Problem Statement

There is a conceptual problem with the filtering logic when the Document slider is positioned anywhere except the last position in the slider order. 

### Current Problematic Behavior

When Document slider is NOT in the last position:
1. User selects a document in the Document slider
2. Subsequent sliders (Partner, Goods, etc.) are filtered to show only entities that are already linked to that selected document
3. This creates a circular dependency problem for document creation workflows

**Example Scenario:**
- Slider order: Journal → Partner → Document → Goods
- User selects a document in Document slider
- Goods slider now shows only goods that are already in that document
- User cannot select new/different goods that aren't already in the document
- This defeats the purpose of creating new documents with new entity combinations

### The Core Issue

The filtering system needs to behave differently based on the current mode:

**Standard Mode (browsing/exploration):**
- Document slider should filter subsequent sliders to show related entities
- This allows users to explore what's inside existing documents

**Document Creation Mode:**
- Document slider should be "invisible" to subsequent sliders
- Subsequent sliders should show all available entities for selection
- This allows users to create new documents with new entity combinations

## Required Solution

### Mode-Aware Filtering Logic

The filtering system in `useChainedQuery.ts` needs to implement mode-aware behavior:

1. **In Standard Mode (`isCreating: false`)**:
   - Document slider affects subsequent sliders normally
   - Subsequent sliders filter by document content when document comes before them

2. **In Document Creation Mode (`isCreating: true`)**:
   - Document slider should be disabled/invisible
   - Subsequent sliders should ignore any document selections
   - Filtering should work as if Document slider doesn't exist

### Implementation Requirements

#### 1. Document Slider Behavior in Creation Mode
```typescript
// In creation mode, Document slider should always be disabled
case SLIDER_TYPES.DOCUMENT:
  if (isCreating) {
    return queryOptions({
      queryKey: [sliderType, "disabled_in_creation_mode"],
      queryFn: async () => ({ data: [], totalCount: 0 }),
      enabled: false,
    });
  }
  // Standard mode logic continues...
```

#### 2. Effective Document Selection
```typescript
// In creation mode, ignore document selections completely
const effectiveDocumentId = isCreating ? null : selectedDocumentId;
```

#### 3. Service Methods Needed

The following service methods need to be implemented to support document filtering in standard mode:

**Journal Service:**
```typescript
// Fetch journals that are linked to a specific document
export async function fetchJournalsForDocument(documentId: string): Promise<JournalClient[]>
```

**Partner Service:**
```typescript
// Add to FetchPartnersParams interface:
interface FetchPartnersParams {
  // ... existing params
  filterByDocumentIds?: string[];
}
```

**Good Service:**
```typescript
// Fetch goods that are in a specific document
export async function findGoodsForDocument(documentId: string): Promise<GoodClient[]>
```

#### 4. Query Keys
```typescript
// Add to journalKeys:
flatListByDocument: (documentId: string | null) =>
  ["flatJournalsFilteredByDocument", documentId] as const,
```

### Expected Behavior After Implementation

#### Standard Mode
```
Slider Order: Journal → Partner → Document → Goods

1. User selects Journal A
2. Partner slider shows partners linked to Journal A
3. User selects Partner B  
4. Document slider shows documents involving Journal A + Partner B
5. User selects Document C
6. Goods slider shows ONLY goods that are in Document C
```

#### Creation Mode
```
Slider Order: Journal → Partner → Document → Goods

1. User selects Journal A
2. Partner slider shows partners linked to Journal A
3. User selects Partner B
4. Document slider is DISABLED (shows no data)
5. Goods slider shows ALL goods linked to Journal A + Partner B
   (ignores any previous document selection)
```

## Current Implementation Status

### Completed Implementation ✅
1. **Standard Mode**: Successfully implemented - Document slider filters subsequent sliders normally
2. **Document Last Position**: Successfully implemented - Document creation workflow when Document slider is in last position

### Document Creation Mode Variations

The application now supports multiple document creation workflows based on Document slider position:

#### J→P→D→G (Partner Locked Mode)
- **Partner Slider**: Locked (shows selected partner but cannot be swiped)
- **Goods Slider**: Active (can select multiple goods with price and quantity)
- **Document Creation**: Single document with one partner and multiple goods
- **Validation**: Standard validation modal before document creation

#### J→G→D→P (Goods Locked Mode)
- **Goods Slider**: Locked (shows selected good but cannot be swiped)
- **Partner Slider**: Active (can select multiple partners)
- **Document Creation**: Multiple documents (one per selected partner, each with the locked good)
- **Validation**: Multiple document creation workflow

#### J→D→P→G (Multiple Partners, Intersection Goods)
- **Partner Slider**: Active (can select multiple partners)
- **Goods Slider**: Shows intersection of goods available to ALL selected partners
- **Document Creation**: N documents (one per selected partner with intersected goods)
- **Logic**: Only goods that are linked to every selected partner are shown

#### J→D→G→P (Multiple Goods, Intersection Partners)
- **Goods Slider**: Active (can select multiple goods)
- **Partner Slider**: Shows intersection of partners that have access to ALL selected goods
- **Document Creation**: N documents (one per intersected partner with selected goods)
- **Logic**: Only partners that are linked to every selected good are shown

### Implementation Details

#### Slider Locking System
- When an entity type appears before Document in the slider order, that slider becomes "locked"
- Locked sliders display the selected entity but prevent navigation/swiping
- User can still see the selection but cannot change it during document creation

#### Intersection Logic
- When Document appears first (J→D→P→G or J→D→G→P), subsequent sliders show intersections
- **Partner Intersection**: Partners who have access to ALL selected goods
- **Goods Intersection**: Goods that are available to ALL selected partners
- This ensures document creation only includes valid entity combinations

#### Multiple Document Creation
- When multiple entities are selected before Document position, multiple documents are created
- Each document contains one instance of the "variable" entity (partner or good)
- All documents share the same "fixed" entities from earlier slider selections

### Files Modified
- `src/hooks/useChainedQuery.ts` - Added mode-aware filtering logic
- Document creation workflows implemented throughout the application

## Next Steps for Implementation

1. **Implement Backend Services**:
   - Add API endpoints that can filter journals, partners, and goods by document IDs
   - Update server-side services to support document-based filtering

2. **Implement Client Services**:
   - Add the missing service methods listed above
   - Update parameter interfaces to support document filtering

3. **Update Query Keys**:
   - Add proper query keys for document-based filtering

4. **Test Mode Switching**:
   - Verify that entering creation mode actually disables document filtering
   - Test that exiting creation mode re-enables standard filtering behavior

5. **Integration Testing**:
   - Test with different slider orders
   - Verify that both modes work correctly
   - Ensure no performance regressions

## Technical Notes

### Key Files to Modify
- `src/app/services/journalService.ts` - Add document filtering backend logic
- `src/app/services/partnerService.ts` - Add document filtering backend logic  
- `src/app/services/goodService.ts` - Add document filtering backend logic
- `src/services/clientJournalService.ts` - Add document filtering client methods
- `src/services/clientPartnerService.ts` - Add document filtering client methods
- `src/services/clientGoodService.ts` - Add document filtering client methods
- `src/app/api/journals/route.ts` - Add document filtering API endpoint
- `src/app/api/partners/route.ts` - Add document filtering API endpoint
- `src/app/api/goods/route.ts` - Add document filtering API endpoint

### Database Considerations
The filtering will likely need to query the `DocumentLine` table to find relationships between documents and other entities:
- Document → Journal: Through `DocumentLine.journalId`
- Document → Partner: Through `DocumentLine.partnerId`  
- Document → Goods: Through `DocumentLine.goodId`

### Performance Considerations
Document-based filtering queries may be complex since they involve joining through the DocumentLine table. Consider:
- Proper indexing on DocumentLine foreign keys
- Query optimization for large datasets
- Caching strategies for frequently accessed document relationships