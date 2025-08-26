# Pending Approval System - User Story Workflows

## User Story 1: Admin Creates Partner in Deep Journal Level

### Scenario
**Admin** (restrictedTopLevelJournalId = null) creates a new Partner in Journal 40 (level 2)

### Step-by-Step Workflow

#### 1. Partner Creation
**Admin logs in and navigates to create partner:**
- Admin selects Journal slider → navigates to Journal 40
- Admin clicks "Add Partner" in Partner slider
- Admin fills partner form (name, type, details)
- Admin clicks "Create Partner"

**System Response:**
- Partner created with status `pending[2, 0]`
- Partner appears in Admin's view with red "Pending" badge
- System message: "Partner created successfully. Awaiting approval chain: Root → Level 1 → Level 2"

#### 2. Root Approval (Admin)
**Admin sees pending partner in inProcess filter:**
- Admin sets Journal filter to "inProcess"  
- Partner slider shows: "ABC Corp - `pending[2, 0]` - [APPROVE]"
- Partner card displays:
  ```
  📋 ABC Corp
  Status: pending[2, 0] - Awaiting root approval
  Created in: Journal 40 (Level 2)
  Progress: [●○○] Root → Level 1 → Level 2
  [APPROVE] [VIEW DETAILS]
  ```

**Admin approves:**
- Admin clicks [APPROVE] button
- Confirmation modal: "Approve ABC Corp at Root level?"
- Admin confirms approval

**System Response:**
- Partner status changes to `pending[2, 1]`
- Admin no longer sees partner in inProcess (not at their approval level)
- System notification to Level 1 approver (Manager of Journal 4)

#### 3. Level 1 Approval (Manager)
**Manager logs in (restrictedTopLevelJournalId = "4"):**
- Manager navigates to Journal slider → selects any journal
- Manager sets filter to "inProcess"
- Partner slider shows: "ABC Corp - `pending[2, 1]` - [APPROVE]"
- Partner card displays:
  ```
  📋 ABC Corp  
  Status: pending[2, 1] - Awaiting Level 1 approval
  Created in: Journal 40 (Level 2)
  Progress: [●●○] Root → Level 1 → Level 2
  Approved by: Admin User (Root)
  [APPROVE] [VIEW DETAILS] [VIEW APPROVAL HISTORY]
  ```

**Manager approves:**
- Manager clicks [APPROVE] button
- Manager adds approval comment: "Partner information verified"
- Manager confirms approval

**System Response:**
- Partner status changes to `pending[2, 2]`
- Manager no longer sees partner in inProcess
- System notification to Level 2 approver (Department user of Journal 40)

#### 4. Level 2 Final Approval (Department User)
**Department User logs in (restrictedTopLevelJournalId = "40"):**
- Department User navigates to Journal 40
- Department User sets filter to "inProcess"
- Partner slider shows: "ABC Corp - `pending[2, 2]` - [APPROVE]"
- Partner card displays:
  ```
  📋 ABC Corp
  Status: pending[2, 2] - Awaiting Level 2 final approval  
  Created in: Journal 40 (Level 2)
  Progress: [●●●] Root → Level 1 → Level 2
  Approved by: 
    - Admin User (Root) - 2024-01-15 10:30
    - Manager User (Level 1) - 2024-01-15 14:15
  [APPROVE] [VIEW DETAILS] [VIEW APPROVAL HISTORY]
  ```

**Department User gives final approval:**
- Department User clicks [APPROVE] button
- Department User adds comment: "Ready for operations in Journal 40"
- Department User confirms final approval

**System Response:**
- Partner status changes to `APPROVED`
- Partner appears in all standard operational views
- Partner becomes available for linking and document creation
- Green "Active" badge replaces red "Pending" badge
- System notifications to all approvers: "ABC Corp is now active"

---

## User Story 2: Department User Creates Partner in Own Journal

### Scenario  
**Department User** (restrictedTopLevelJournalId = "40") creates Partner in Journal 40

### Workflow Overview
The approval chain is **identical** to User Story 1:
1. Root approval (Admin)
2. Level 1 approval (Manager)  
3. Level 2 approval (Department User - creator)

**Key Difference:**
- Department User created the partner but still must wait for hierarchical approval
- Department User cannot approve until Root and Level 1 have approved first
- Department User sees their own creation as `pending[2, 0]` initially but cannot approve it

---

## User Story 3: Link Creation and Approval

### Scenario
**Manager** (restrictedTopLevelJournalId = "4") creates Journal-Partner-Good link in Journal 40

### Step-by-Step Workflow

#### 1. Link Creation
**Manager navigates to linking interface:**
- Manager selects Journal 40 in Journal slider
- Manager selects approved Partner "ABC Corp" in Partner slider  
- Manager selects approved Good "Widget A" in Goods slider
- Manager clicks "Create Link" button

**Link creation form:**
```
🔗 Create Journal-Partner-Good Link

Journal: 40 (Level 2)
Partner: ABC Corp ✓ APPROVED
Good: Widget A ✓ APPROVED

Partnership Type: [STANDARD_TRANSACTION ▼]
Contextual Tax Code: [VAT_20 ▼]
Descriptive Text: [Custom pricing for bulk orders]

[CREATE LINK] [CANCEL]
```

**System Response:**
- Link created with status `pending[2, 0]`
- Link appears in Manager's linking view with pending badge
- System message: "Link created. Awaiting approval: Root → Level 1 → Level 2"

#### 2. Link Approval Chain

**Root Approval (Admin view):**
```
🔗 Journal-Partner-Good Links - InProcess

Journal 40 | ABC Corp → Widget A
Status: pending[2, 0] - Awaiting root approval
Partnership: STANDARD_TRANSACTION
Tax: VAT_20%
Progress: [●○○] Root → Level 1 → Level 2
[APPROVE LINK] [VIEW DETAILS]
```

**Level 1 Approval (Manager view after root approval):**
```
🔗 Journal-Partner-Good Links - InProcess

Journal 40 | ABC Corp → Widget A  
Status: pending[2, 1] - Awaiting Level 1 approval
Partnership: STANDARD_TRANSACTION
Tax: VAT_20%
Progress: [●●○] Root → Level 1 → Level 2
Approved by: Admin User (Root) - 2024-01-15 09:45
[APPROVE LINK] [VIEW DETAILS] [APPROVAL HISTORY]
```

**Level 2 Final Approval (Department User view):**
```
🔗 Journal-Partner-Good Links - InProcess

Journal 40 | ABC Corp → Widget A
Status: pending[2, 2] - Awaiting Level 2 final approval
Partnership: STANDARD_TRANSACTION  
Tax: VAT_20%
Progress: [●●●] Root → Level 1 → Level 2
Approved by:
  - Admin User (Root) - 2024-01-15 09:45
  - Manager User (Level 1) - 2024-01-15 11:30
[APPROVE LINK] [VIEW DETAILS] [APPROVAL HISTORY]
```

#### 3. Link Becomes Active
**After final approval:**
- Link status becomes `APPROVED`
- Link appears in document creation workflows
- Link enables ABC Corp ↔ Widget A transactions in Journal 40
- Pricing and tax settings become operational

---

## UI Components and Visual Elements

### Approval Status Badges
```css
.pending-badge {
  background: #ff6b35;
  color: white;
  badge: "PENDING[2,1]";
}

.approved-badge {
  background: #4caf50;  
  color: white;
  badge: "ACTIVE";
}
```

### Progress Indicators
```
Visual: [●●○] Root → Level 1 → Level 2
- ● = Approved level (green)
- ○ = Pending level (gray)
- Current pending level highlighted
```

### InProcess Filter Enhancement
```
Filter Options:
○ All
○ Active  
● InProcess (Shows: 5 pending items at your level)
○ Archived
```

### Approval Action Buttons
```
Primary: [APPROVE] - Blue, prominent
Secondary: [VIEW DETAILS] - Gray outline
Tertiary: [APPROVAL HISTORY] - Text link
```

### Notification System
- **Toast notifications** for approval status changes
- **Badge counts** on navigation items (e.g., "InProcess (3)")
- **Email notifications** for pending approvals (future)

### Approval Comments
```
💬 Approval History
┌─ Admin User (Root) - Jan 15, 10:30 AM
│  "Partner details verified against registry"
├─ Manager User (Level 1) - Jan 15, 2:15 PM  
│  "Approved for Journal 4 operations"
└─ Pending Level 2 approval...
```

## Error Handling and Edge Cases

### Invalid Approval Attempts
- User tries to approve at wrong level → "You can only approve items at Level X"
- User tries to approve already processed item → "Item already approved/rejected"
- User tries to approve own creation prematurely → "Awaiting higher level approval first"

### Visual Feedback
- Disabled [APPROVE] buttons when not user's turn
- Clear messaging about required approval sequence  
- Progress indicators showing current position in chain
- Approval history showing who approved and when

### Bulk Operations
- **Future enhancement**: Select multiple pending items for batch approval
- **Validation**: Only items at user's approval level can be batch selected
- **Progress**: Batch approval progress indicator

This workflow ensures complete transparency in the approval process while maintaining strict hierarchical control and providing clear user guidance at every step.