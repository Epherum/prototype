# Pending Approval System - Business Requirements

## Overview

The ERP application will implement a hierarchical approval system where all newly created Partners, Goods, Documents, and their linking relationships require approval before becoming active. The approval process follows the journal hierarchy from the deepest level up to the root, ensuring proper authorization at each organizational level.

## Core Principles

### 1. Default Pending Status
- **ALL** newly created entities (Partners, Goods, Documents, Links) are created with `PENDING` status
- No entity becomes `ACTIVE` without explicit approval
- Only approved entities appear in standard operational workflows

### 2. Hierarchical Approval Chain
- Approval follows the journal hierarchy path from root down to creation level
- Each level must approve before moving to the next deeper level
- Only users restricted to the current pending level can approve

### 3. Restricted Journal Authorization
- Users can only approve items at their restricted journal level
- Admin (root restriction) can approve items pending at root level (level 0)
- Journal-restricted users can only approve at their specific restriction level

## Journal Hierarchy Structure

### Level Numbering System
```
Root Journal (id: null)           → Level 0
├── Journal 4                     → Level 1
│   ├── Journal 40                → Level 2
│   │   └── Journal 400           → Level 3
│   └── Journal 41                → Level 2
└── Journal 5                     → Level 1
```

### User Restriction Mapping
- **Admin User**: `restrictedTopLevelJournalId = null` → Can approve Level 0 (root)
- **Manager User**: `restrictedTopLevelJournalId = "4"` → Can approve Level 1 (journal 4)
- **Department User**: `restrictedTopLevelJournalId = "40"` → Can approve Level 2 (journal 40)

## Approval Workflow Mechanics

### Creation Process
1. User creates entity (Partner/Good/Document) in journal X
2. System determines hierarchy path from journal X to root
3. Entity created with `status = PENDING` and approval metadata:
   - `creationJournalLevel`: The level where entity was created
   - `currentPendingLevel`: Current level waiting for approval (starts at 0 - root)

### Approval Process
1. Entity shows as `pending[creationLevel, currentPendingLevel]`
2. User with matching restriction can approve at their level
3. Upon approval, `currentPendingLevel` increments toward creation level
4. Process starts at level 0 (root) and progresses down the hierarchy
5. Final approval at creation level sets `status = APPROVED`

### Example Approval Flow
Entity created in Journal 40 (level 2):
```
Initial:    pending[2, 0] → Awaiting root approval (level 0)
Step 1:     pending[2, 1] → Root approved, awaiting level 1 approval  
Step 2:     pending[2, 2] → Level 1 approved, awaiting level 2 approval
Final:      APPROVED       → Level 2 approved, entity becomes active
```

## Entity-Specific Requirements

### Partners
- Created with `approvalStatus = PENDING`
- Must specify creation journal for hierarchy calculation
- Approval metadata includes partner details and creation context

### Goods and Services
- Created with `approvalStatus = PENDING`  
- Linked to creation journal for approval path determination
- Good-Journal links also require separate approval process

### Documents
- Created with `approvalStatus = PENDING`
- Journal association determines approval hierarchy
- Document lines follow parent document approval status

### Linking Relationships

#### Journal-Partner Links
- All new links created as `PENDING`
- Follow same hierarchical approval as entities
- Display approval status alongside entity approvals

#### Journal-Good Links
- Require approval at journal level where link is created
- Cannot link to child journals without parent approval
- Maintains existing hierarchical enforcement rules

#### Journal-Partner-Good (JPG) Links
- Three-way relationship requiring approval
- Approval level determined by the journal in the relationship
- Special UI consideration needed for complex relationship display

## UI/UX Specifications

### In-Process Filter Enhancement

#### Current State vs. New Requirements
- **Current**: `inProcess` filter shows entities with `PENDING` status
- **New**: `inProcess` filter shows entities pending at user's restriction level

#### Filter Behavior by User Type
```typescript
// Admin (restrictedTopLevelJournalId = null) 
// Shows all entities with currentPendingLevel = 0 (awaiting root approval)

// Manager (restrictedTopLevelJournalId = "4")
// Shows all entities with currentPendingLevel = 1 (awaiting level 1 approval) 

// Department (restrictedTopLevelJournalId = "40")
// Shows all entities with currentPendingLevel = 2 (awaiting level 2 approval)
```

### Approval Status Display

#### Primary Status Format
All pending entities display as: `pending[creationLevel, currentPendingLevel]`

Examples:
- `pending[2, 0]` → Created at level 2, awaiting root approval
- `pending[3, 1]` → Created at level 3, awaiting level 1 approval
- `pending[1, 1]` → Created at level 1, awaiting level 1 approval

#### Visual Indicators
- **Color coding**: Different colors for each pending level
- **Progress indicators**: Visual representation of approval progress
- **Badge system**: Clear visual distinction from approved entities

### Slider Interface Changes

#### Journal Slider
- L1 journal selection determines `inProcess` filter scope
- Only shows entities pending at user's approval level
- Clear indication of approval jurisdiction

#### Partner/Good/Document Sliders
- Display approval status prominently
- Show approval progress visually
- Enable approval actions for authorized users

### Linking Relationships Display

#### Journal-Partner Links
- Show approval status alongside partnership type
- Visual indication of link approval progress
- Enable link-specific approval actions

#### Journal-Good Links  
- Display approval status in goods listing
- Show journal-good relationship approval state
- Maintain hierarchical link enforcement

#### Journal-Partner-Good Links
**Recommended Display Approaches:**

1. **Tabular View**
   ```
   Partner Name | Good Name | Journal | Status | Approval
   ABC Corp     | Widget A  | 40      | pending[2,1] | [Approve]
   ```

2. **Card-Based View**
   ```
   [Partner: ABC Corp]
   └── Widget A (Journal 40)
       Status: pending[2,1] 
       [Approve Link] [View Details]
   ```

3. **Hierarchical Tree View**
   ```
   📁 Journal 40
   ├── 🏢 ABC Corp → pending[2,1]
   │   └── 📦 Widget A → pending[2,0]
   │       └── 🔗 Link Status: pending[2,1]
   ```

## Database Schema Extensions

### Required New Fields

#### Approval Tracking Fields
```sql
-- Add to partners, goods_and_services, documents tables
creation_journal_level INTEGER NOT NULL,
current_pending_level INTEGER NOT NULL,
approval_history JSONB, -- Track approval chain
```

#### Status Metadata
```sql
-- Enhanced status tracking
approval_metadata JSONB, -- Store approval context
approved_by_user_ids TEXT[], -- Track approvers at each level
approval_timestamps TIMESTAMP[], -- Track approval times
```

### Linking Tables Approval
```sql
-- Add approval fields to linking tables
-- journal_partner_links
approval_status approval_status_enum DEFAULT 'PENDING',
creation_level INTEGER NOT NULL,
current_pending_level INTEGER NOT NULL,

-- journal_good_links  
approval_status approval_status_enum DEFAULT 'PENDING',
creation_level INTEGER NOT NULL,
current_pending_level INTEGER NOT NULL,

-- journal_partner_good_links
approval_status approval_status_enum DEFAULT 'PENDING', 
creation_level INTEGER NOT NULL,
current_pending_level INTEGER NOT NULL,
```

## Business Rules

### Approval Authority
1. Users can ONLY approve entities at their restriction level
2. Approval must proceed sequentially up the hierarchy
3. No level can be skipped in approval process
4. Root approval is always the final step

### Entity Visibility
1. `PENDING` entities only visible in `inProcess` filter
2. Only `APPROVED` entities appear in standard operations
3. `REJECTED` entities require separate workflow (future enhancement)

### Workflow Integrity
1. Approval cannot be reversed without explicit rejection workflow
2. Entity modifications while pending require re-approval
3. Approval history maintained for audit purposes

### Journal Hierarchy Enforcement
1. Approval levels calculated from current journal hierarchy
2. Hierarchy changes don't affect pending approvals (frozen at creation)
3. Approval path determined at entity creation time

## Implementation Phases

### Phase 1: Core Approval Infrastructure
- Database schema extensions
- Basic approval status tracking
- Level calculation algorithms

### Phase 2: UI/UX Integration
- Enhanced `inProcess` filtering
- Approval status displays
- Basic approval actions

### Phase 3: Advanced Features  
- Complex linking approval workflows
- Approval history tracking
- Batch approval capabilities

### Phase 4: Workflow Optimization
- Notification system for pending approvals
- Approval delegation mechanisms
- Performance optimization for large hierarchies

## Success Criteria

1. All new entities created as `PENDING` status
2. Approval workflow follows journal hierarchy correctly
3. Users can only approve at their authorized level
4. `inProcess` filter shows relevant pending items
5. Approval status clearly visible throughout UI
6. Linking relationships properly integrated with approval system
7. Performance maintained with approval overhead
8. Audit trail complete for all approval actions

## Future Enhancements

- **Rejection Workflow**: Handle rejected entities and re-submission
- **Bulk Approval**: Enable batch approval of multiple entities
- **Approval Notifications**: Email/system notifications for pending items
- **Approval Delegation**: Temporary approval authority delegation
- **Approval Analytics**: Reporting on approval bottlenecks and patterns
- **Advanced Permissions**: Fine-grained approval permissions beyond journal restriction