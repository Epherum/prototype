# Journal Multi-Level Hierarchy Display - Business Requirements

## Current State Analysis

The journal hierarchical display currently shows only **2 levels**:
- **1st Row (L1)**: Top-level journals from the selected hierarchy root
- **2nd Row (L2)**: Children of selected L1 journals

**Current Algorithm:**
- User selects journal "3" → shows children "30", "31" in 2nd row
- Selection stops at 2nd level regardless of deeper hierarchy

## Business Requirement: Full-Depth Hierarchy Display

### Objective
Allow users to view and interact with **all levels** of the journal hierarchy, not just the first two levels.

### Expected Behavior

**Scenario Example:**
- User selects journal "3" → shows "30", "31" in 2nd Row
- User selects "30" → shows "300", "301", "302" in 3rd Row  
- User selects "301" → shows "3010", "3011" in 4th Row
- Continue until terminal nodes are reached

### Functional Requirements

#### 1. Dynamic Level Expansion
- **Current**: Fixed 2-level display (1st Row, 2nd Row)
- **Required**: Dynamic N-level display (1st Row, 2nd Row, 3rd Row, ..., Nth Row)
- Each new level should appear when parent selections are made
- Empty levels should be hidden

#### 2. Selection Cascading Logic
- When user selects journal at Level N, show its children at Level N+1
- Multiple selections at same level should aggregate children from all selected parents
- Maintain existing color inheritance from top-level parents

#### 3. Navigation Behavior
- **Drill Down**: Double-click any non-terminal node navigates to that level as new root
- **Drill Up**: Maintain current double-click context navigation
- **Breadcrumb Context**: Display current hierarchy path

#### 4. Filtering Algorithm Impact

**Current Filtering Modes:**
- `affected`: Entities linked to selected journal hierarchy
- `unaffected`: Entities linked to parent path but NOT deepest selection  
- `inProcess`: Same as affected but PENDING status only

**Multi-Level Requirements:**
- Apply filtering to the **deepest selected level** across all visible levels
- If user selects journals at levels 1, 2, and 3, filter based on level 3 selections
- Maintain hierarchical relationship validation (goods cannot be linked to child unless linked to parent)

#### 5. State Management Updates

**Additional State Requirements:**
```typescript
// Extend existing selectedLevel2Ids, selectedLevel3Ids pattern
selectedLevel2Ids: string[]  // Current L1 (1st Row)
selectedLevel3Ids: string[]  // Current L2 (2nd Row)  
selectedLevel4Ids: string[]  // New L3 (3rd Row)
selectedLevel5Ids: string[]  // New L4 (4th Row)
// ... continue for required depth
```

**Dynamic Level Management:**
- `activeLevels`: number of currently visible levels
- `maxDepthReached`: boolean indicating if terminal nodes reached
- Level-specific visibility maps for each hierarchy level

#### 6. Performance Considerations
- **Lazy Loading**: Only fetch children when parent is selected
- **Pagination**: For levels with >100 items, implement pagination
- **Dynamic Expansion**: Unlimited levels - expand automatically based on user selections
- **Memory Management**: Efficient cleanup of unused levels

#### 7. User Experience Requirements

**Visual Design:**
- Consistent row styling across all levels
- Clear visual hierarchy with progressive indentation or styling
- Level headers dynamically labeled ("1st Row", "2nd Row", "3rd Row", ...)

**Interaction Patterns:**
- Maintain existing single-click selection behavior at all levels
- Preserve click-cycle logic for parent nodes at any level
- Support "Select All Visible" across all displayed levels

#### 8. Database Query Optimization

**Current Limitation:**
- `getJournalSubHierarchy()` fetches complete subtree but UI only uses 2 levels

**Optimization Approach:**
- Implement level-aware queries that fetch only needed depth
- Cache intermediate results for navigation performance
- Use recursive CTE queries optimized for specific depth ranges

### Implementation Phases

**Phase 1: Core Multi-Level Display**
- Extend UI to support 3-4 levels dynamically
- Update state management for additional levels
- Modify filtering to use deepest selections

**Phase 2: Performance & UX**
- Implement lazy loading and pagination
- Add breadcrumb navigation
- Optimize database queries

**Phase 3: Advanced Features**
- Enhanced visual hierarchy indicators
- Bulk operations across multiple levels
- Advanced filtering across all levels

### Success Criteria
1. Users can navigate journal hierarchy to unlimited depth
2. All existing filtering modes work correctly with multi-level selections  
3. Performance remains acceptable with deep hierarchies through dynamic loading
4. No breaking changes to existing journal selection behavior
5. Intuitive user experience that scales the current 2-level interaction patterns

### Technical Impact Assessment

**Database**: No schema changes required - existing recursive queries support any depth

**API**: Minimal changes - mostly extending existing query parameters for level specification

**UI Components**: Moderate refactoring - generalize level-specific components to support N levels

**State Management**: Significant changes - extend selection arrays and visibility mapping logic

**Performance**: Dynamic level calculation with automatic expansion - no artificial limits