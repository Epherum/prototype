# Pending Approval System - Definitive Specification

## Overview

The ERP application implements a hierarchical approval system where all newly created Partners, Goods, Documents, and their linking relationships require approval before becoming active. The approval process follows the journal hierarchy from root level down to the creation level, ensuring proper authorization at each organizational level.

## Core Architecture

### 1. Approval Direction (Root → Deepest Level)
The approval chain ALWAYS follows this sequence:
```
Root Level (Admin) → Level 1 → Level 2 → Level 3... → Creation Level
```

**Example for entity created in Journal 40 (Level 2):**
```
Step 1: Admin (Root) approves        → pending[2, 0] → pending[2, 1]
Step 2: Manager (Level 1) approves   → pending[2, 1] → pending[2, 2]  
Step 3: Dept User (Level 2) approves → pending[2, 2] → APPROVED
```

### 2. Status Format
All pending entities display as: `pending[creationLevel, currentPendingLevel]`

Examples:
- `pending[2, 0]` → Created at level 2, awaiting root approval
- `pending[2, 1]` → Created at level 2, awaiting level 1 approval
- `pending[2, 2]` → Created at level 2, awaiting level 2 (final) approval

## UI Implementation: In-Process Slider Within Journal Slider

### Core Concept
When Journal slider is in first position and user clicks "inProcess" filter, it opens a **nested slider WITHIN the Journal slider** that:
- Does NOT affect any sliders below it
- Operates entirely within the hierarchical journal context
- Shows approval-pending entities for selected journal(s)

### Interface Design

#### 1. InProcess Filter Activation
```
Journal Slider (Position 1)
┌─────────────────────────────────────────────────────────────┐
│ Filters: [All] [Active] [●InProcess] [Archived]            │
│                                                             │
│ When InProcess clicked:                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ APPROVAL CENTER                                         │ │
│ │ Entity Filters: [Partner] [Good] [Link] [Document]     │ │
│ │ (Multiple selection allowed)                            │ │
│ │                                                         │ │
│ │ Selected Journals: Journal 4, Journal 40               │ │
│ │ └─ Showing pending items for user's approval level     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Entity Filter Options
Users can select multiple entity types simultaneously:
- **[Partner]** - Shows pending partners awaiting approval
- **[Good]** - Shows pending goods and services awaiting approval  
- **[Link]** - Shows pending linking relationships (Journal-Partner, Journal-Good, JPG)
- **[Document]** - Shows pending documents awaiting approval

#### 3. Journal Scope Rules
- **If journals selected**: Shows pending items only for those journals
- **If no journals selected**: Shows ALL pending items under user's restricted journal hierarchy
- **Visibility**: Shows ALL pending items (enables oversight of approval bottlenecks)
- **Approval authority**: Restricted to user's approval level only

### User Authorization and Visibility Rules

#### Visibility vs Approval Authority
**Key Principle**: Users can **SEE ALL** pending items but can only **APPROVE** items at their restriction level.

**Visibility Rules:**
- **Show ALL pending entities** regardless of currentPendingLevel
- **Default filter (no entity types selected)**: Show only items at user's approval level
- **With entity type filters**: Show ALL pending items of selected types
- Users can see bottlenecks at all levels (accountability/management oversight)

**Approval Authority:**
- **Admin User** (`restrictedTopLevelJournalId = null`): Can only approve items with `currentPendingLevel = 0`
- **Manager User** (`restrictedTopLevelJournalId = "4"`): Can only approve items with `currentPendingLevel = 1`  
- **Department User** (`restrictedTopLevelJournalId = "40"`): Can only approve items with `currentPendingLevel = 2`

#### Filtering Logic
```typescript
// Pseudo-code for InProcess filtering
function getInProcessItems(user, selectedJournals, entityTypes) {
  const userLevel = getUserApprovalLevel(user.restrictedTopLevelJournalId);
  const journalScope = selectedJournals.length > 0 
    ? selectedJournals 
    : getAllJournalsUnderRestriction(user.restrictedTopLevelJournalId);
  
  // If no entity types selected, show only items at user's level (default behavior)
  if (entityTypes.length === 0) {
    return entities.filter(entity => 
      entity.currentPendingLevel === userLevel &&
      journalScope.includes(entity.creationJournal)
    );
  }
  
  // If entity types selected, show ALL pending items of those types
  return entities.filter(entity => 
    entity.approvalStatus === 'PENDING' &&
    journalScope.includes(entity.creationJournal) &&
    entityTypes.includes(entity.type)
  );
}
```

## Approval Workflows

### Entity Creation Process
1. User creates entity (Partner/Good/Document/Link) in journal X
2. System calculates hierarchy path from journal X to root
3. Entity created with:
   - `approvalStatus = PENDING`
   - `creationJournalLevel = X`
   - `currentPendingLevel = 0` (always starts at root)

### Approval Chain Execution
1. **Root Approval (Level 0)**: Admin reviews and approves
   - `currentPendingLevel` increments from 0 → 1
   - Entity moves out of Admin's InProcess view
   - Entity appears in Level 1 user's InProcess view

2. **Level 1 Approval**: Manager reviews and approves
   - `currentPendingLevel` increments from 1 → 2
   - Entity moves out of Manager's InProcess view
   - Entity appears in Level 2 user's InProcess view

3. **Final Approval**: Department User reviews and approves
   - `approvalStatus` changes from PENDING → APPROVED
   - Entity becomes active in all standard operational views
   - Entity disappears from all InProcess views

### Business Rules

#### Approval Authority
1. Users can ONLY approve entities at their exact restriction level
2. Approval must proceed sequentially: Root → L1 → L2 → L3...
3. No level can be skipped in the approval process
4. Higher levels cannot approve items pending at lower levels

#### Entity Visibility
1. PENDING entities appear in InProcess views
2. Users can SEE ALL pending entities (for oversight and bottleneck identification)
3. APPROVED entities appear in standard operational sliders
4. Users can only APPROVE entities at their authorization level

## Implementation Requirements

### Database Schema Extensions

#### Core Entity Tables
Add to partners, goods_and_services, documents:
```sql
creation_journal_level INTEGER NOT NULL,
current_pending_level INTEGER NOT NULL DEFAULT 0,
approval_history JSONB,
approved_by_user_ids TEXT[],
approval_timestamps TIMESTAMP[]
```

#### Linking Tables  
Add to journal_partner_links, journal_good_links, journal_partner_good_links:
```sql
approval_status approval_status_enum DEFAULT 'PENDING',
creation_level INTEGER NOT NULL,
current_pending_level INTEGER NOT NULL DEFAULT 0,
approval_metadata JSONB
```

### API Endpoints

#### InProcess Query
```typescript
GET /api/approval/inprocess?entityTypes=partner,good&journalIds=4,40
// Returns entities pending at user's approval level
```

#### Approval Action
```typescript
POST /api/approval/approve
{
  entityType: 'partner',
  entityId: 'abc-123',
  comments: 'Partner details verified'
}
```

### UI Components

#### ApprovalCenter Component
```typescript
interface ApprovalCenterProps {
  isOpen: boolean;
  selectedJournals: string[];
  onEntityTypeFilter: (types: EntityType[]) => void;
  onApprove: (entityType: string, entityId: string) => void;
}
```

#### PendingEntityCard Component
```typescript
interface PendingEntityCardProps {
  entity: PendingEntity;
  approvalLevel: number;
  onApprove: () => void;
  showApprovalHistory: boolean;
}
```

## User Experience Flows

### Scenario 1: Admin Oversight and Approval
1. Admin clicks InProcess filter in Journal slider (position 1)
2. Approval Center opens within Journal slider
3. **Default view (no filters)**: Shows only items at Admin's level (`currentPendingLevel = 0`)
4. **Admin selects [Partner] + [Good] filters**: Shows ALL pending partners and goods at ALL levels
5. Admin sees comprehensive list:
   ```
   📋 ABC Corp - pending[2, 0] - Created in Journal 40 [APPROVE] ← Admin can approve
   📋 DEF Inc - pending[2, 1] - Created in Journal 40 [VIEW ONLY] ← Awaiting Manager
   📋 GHI Ltd - pending[2, 2] - Created in Journal 40 [VIEW ONLY] ← Awaiting Dept User
   Progress indicators show bottlenecks at each level
   ```
6. Admin can only click [APPROVE] on items with `currentPendingLevel = 0`
7. Items at other levels show [VIEW DETAILS] only (no approve button)

### Scenario 2: Department User Management and Approval
1. Department User (restricted to Journal 40) clicks InProcess
2. **Default view**: Shows only entities with `currentPendingLevel = 2` (items awaiting their approval)
3. **With [Partner] filter**: Shows ALL pending partners at ALL levels within Journal 40 hierarchy
4. User sees oversight view:
   ```
   📋 ABC Corp - pending[2, 2] - Final Approval Required [APPROVE] ← Can approve
   📋 DEF Inc - pending[2, 0] - Awaiting Admin [VIEW ONLY] ← Admin bottleneck
   📋 GHI Ltd - pending[2, 1] - Awaiting Manager [VIEW ONLY] ← Manager bottleneck
   Progress: [●●●] Root → Level 1 → Level 2
   ```
5. User can identify approval bottlenecks at higher levels
6. User provides final approval only for items at their level
7. Entity status changes to APPROVED and becomes operationally active

## Visual Design Specifications

### Approval Status Indicators
```
pending[2,0] → 🟠 Badge: "PENDING ROOT"
pending[2,1] → 🟡 Badge: "PENDING L1"  
pending[2,2] → 🟢 Badge: "PENDING L2"
APPROVED     → ✅ Badge: "ACTIVE"
```

### Progress Visualization
```
[●○○] → Root approved, awaiting Level 1
[●●○] → Root + L1 approved, awaiting Level 2
[●●●] → All levels approved (entity active)
```

### Entity Filter Buttons
```css
.entity-filter {
  multi-select: true;
  active-color: #2563eb;
  inactive-color: #6b7280;
  badge-count: true; /* Shows count of pending items */
}
```

## Success Criteria

1. ✅ InProcess opens nested slider within Journal slider (position 1 only)
2. ✅ Nested slider does NOT affect sliders below it
3. ✅ Multi-select entity type filtering works correctly
4. ✅ Journal selection properly scopes approval items
5. ✅ Users only see items pending at their approval level
6. ✅ Approval direction always flows Root → Creation Level
7. ✅ Approval chain cannot be bypassed or reversed
8. ✅ Entity status updates correctly through approval chain
9. ✅ Final approval makes entities operationally active
10. ✅ Clear visual feedback for approval progress and authority

This specification provides the definitive design for a hierarchical approval system that maintains proper authorization flow while providing an intuitive user experience through the nested InProcess slider interface.