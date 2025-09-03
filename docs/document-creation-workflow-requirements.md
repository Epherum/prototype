# Document Creation Workflow - Business Requirements

## Executive Summary

The ERP system's revolutionary dynamic slider interface supports 5 different document creation workflows based on slider positioning. Currently, 3 out of 5 workflows (60% of functionality) are broken due to incorrect query dependency logic when the Document slider is positioned before Partner and/or Goods sliders.

## Problem Statement

When users initiate document creation with the Document slider positioned before Partner and/or Goods sliders in the slider order, those subsequent sliders display as empty instead of showing available options. This breaks the intended multi-select document creation workflows.

## Current System Architecture

### Slider Order Configurations & Creation Modes

1. **SINGLE_ITEM** (`Journal → Partner → Goods → Document`)
   - Status: ✅ **Working** 
   - Behavior: Traditional workflow - select one of each entity type
   - Document creation: Single document with locked selections

2. **PARTNER_LOCKED** (`Journal → Partner → Document → Goods`)
   - Status: ❌ **Broken**
   - Expected: Partner locked, user selects multiple goods
   - Current: Goods slider shows empty due to document dependency

3. **GOODS_LOCKED** (`Journal → Goods → Document → Partner`)
   - Status: ❌ **Broken**
   - Expected: Good locked, user selects multiple partners  
   - Current: Partner slider shows empty due to document dependency

4. **MULTIPLE_PARTNERS** (`Journal → Document → Partners → Goods`)
   - Status: ❌ **Broken**
   - Expected: User selects multiple partners, goods show intersection
   - Current: Both Partner and Goods sliders show empty

5. **MULTIPLE_GOODS** (`Journal → Document → Goods → Partners`)
   - Status: ❌ **Broken**
   - Expected: User selects multiple goods, partners show intersection
   - Current: Both Goods and Partner sliders show empty

### Root Cause Analysis

**Location**: `src/hooks/useChainedQuery.ts:140-149`

```typescript
// Current problematic logic
if (hasDocumentDependency && !effectiveDocumentId && sliderType !== SLIDER_TYPES.JOURNAL) {
  return queryOptions({
    queryKey: [sliderType, "disabled_empty_document"],
    queryFn: async () => ({ data: [], totalCount: 0 }),
    enabled: false,
  });
}
```

**Issue**: During document creation mode (`isCreating: true`):
- Document slider is correctly disabled to prevent selection
- `effectiveDocumentId` is intentionally set to `null` 
- Partner/Goods sliders detect document dependency but see null document
- Queries are incorrectly disabled, causing empty sliders

## Business Requirements for Fix

### Functional Requirements

#### FR1: Document Creation Mode Detection
- System MUST distinguish between standard mode and document creation mode
- During creation mode, dependency rules MUST be relaxed for Partner/Goods sliders
- Journal dependencies MUST still be enforced (journals filter all subsequent sliders)

#### FR2: Slider Population During Creation
- **PARTNER_LOCKED Mode**: Goods slider MUST show all goods available for selected partner + journals
- **GOODS_LOCKED Mode**: Partner slider MUST show all partners available for selected good + journals  
- **MULTIPLE_PARTNERS Mode**: Partner slider MUST show all partners for selected journals
- **MULTIPLE_GOODS Mode**: Goods slider MUST show all goods for selected journals

#### FR3: Intersection Queries
- **MULTIPLE_PARTNERS Mode**: After partner selection, Goods slider MUST show intersection of goods available across selected partners + journals
- **MULTIPLE_GOODS Mode**: After goods selection, Partner slider MUST show intersection of partners available across selected goods + journals

#### FR4: Creation Flow Integrity
- Document slider MUST remain disabled during creation mode
- Users MUST NOT be able to select existing documents during creation
- All other standard mode behaviors MUST be preserved when not in creation mode

### Non-Functional Requirements

#### NFR1: Performance
- Query enabling logic changes MUST NOT impact query performance
- Intersection calculations MUST be efficient for large datasets

#### NFR2: Backward Compatibility
- Fix MUST NOT break existing SINGLE_ITEM workflow
- Standard mode (non-creation) behavior MUST remain unchanged

#### NFR3: User Experience
- Loading states MUST be consistent across all creation modes
- Error handling MUST be graceful if intersection queries return empty results

## Expected User Workflows

### Scenario 1: PARTNER_LOCKED Mode (`J→P→D→G`)
1. User selects Journal(s)
2. User selects Partner
3. User clicks "Create Document" 
4. **Expected**: Goods slider populates with goods available for selected partner + journals
5. User selects multiple goods
6. System creates document with multiple line items

### Scenario 2: MULTIPLE_PARTNERS Mode (`J→D→P→G`)
1. User selects Journal(s)
2. User clicks "Create Document"
3. **Expected**: Partner slider populates with all partners for selected journals
4. User selects multiple partners
5. **Expected**: Goods slider populates with intersection of goods across selected partners
6. User selects goods
7. System creates multiple documents or single document with multiple partners

### Scenario 3: MULTIPLE_GOODS Mode (`J→D→G→P`)
1. User selects Journal(s)
2. User clicks "Create Document"
3. **Expected**: Goods slider populates with all goods for selected journals
4. User selects multiple goods
5. **Expected**: Partner slider populates with intersection of partners across selected goods
6. User selects partners
7. System creates documents accordingly

## Technical Implementation Requirements

### Query Logic Updates Needed

1. **Document Dependency Check**: Modify `useChainedQuery.ts` to bypass document dependency during creation mode for Partner/Goods sliders

2. **Creation Mode Context**: Ensure `isCreating` state is properly propagated to query enabling logic

3. **Intersection Queries**: Implement efficient intersection queries for multi-select scenarios

4. **State Management**: Ensure proper state management for locked entities during creation

## Success Criteria

### Functional Validation
- ✅ SINGLE_ITEM mode continues working (no regression)
- ✅ PARTNER_LOCKED mode: Goods slider populates correctly
- ✅ GOODS_LOCKED mode: Partner slider populates correctly  
- ✅ MULTIPLE_PARTNERS mode: Both sliders populate with correct data
- ✅ MULTIPLE_GOODS mode: Both sliders populate with correct data

### Technical Validation
- ✅ No performance degradation in query execution
- ✅ Proper loading states during creation mode
- ✅ Error handling for empty intersection cases
- ✅ All existing unit tests pass
- ✅ New integration tests for creation modes pass

## Risk Assessment

### High Risk
- **Query Performance**: Intersection queries might be slower than single entity queries
- **State Complexity**: Multiple creation modes increase state management complexity

### Medium Risk  
- **User Confusion**: Different behaviors based on slider order might confuse users
- **Testing Coverage**: Multiple workflows require comprehensive test coverage

### Low Risk
- **Backward Compatibility**: Well-isolated fix should not affect existing functionality

## Dependencies

- No external API changes required
- No database schema changes required  
- Frontend query logic modifications only
- Existing state management infrastructure sufficient

---

**Document Version**: 1.0  
**Date**: 2025-09-02  
**Status**: Requirements Defined - Ready for Implementation