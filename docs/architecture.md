
# ERP Application Architecture (Revised)

This document outlines the high-level architecture of the ERP application, focusing on its core components, data flow, and key design principles.

## 1. Overview

The ERP application is a Next.js-based web application designed to manage various business entities such as Journals, Partners, Goods, and Documents. It leverages a modular, component-driven approach with a centralized state management system and a robust, context-aware data fetching strategy. The application's core feature is its dynamic "slider" interface, where the order of sliders can be reconfigured by the user, fundamentally changing the data filtering and entity creation workflows.

## 2. Technology Stack

*   **Frontend:** React (Next.js)
*   **State Management:** Zustand
*   **Data Fetching/Caching:** TanStack Query (React Query)
*   **Styling:** CSS Modules
*   **UI Animations:** Framer Motion
*   **Database:** PostgreSQL (via Prisma ORM)
*   **Authentication:** NextAuth.js

## 3. Core Components and Data Flow

The application's main interface (`src/app/page.tsx`) orchestrates the display and interaction of various "sliders" (Journal, Partner, Goods, Document, Project). These sliders represent different business entities, and their behavior is determined by two primary operating modes: **Standard Mode** (for browsing and filtering) and **Document Creation Mode** (for creating new documents).

### 3.1. State Management (`src/store/appStore.ts`)

The application uses Zustand for global state management. The `useAppStore` hook provides access to the application's state. Key slices include:

*   **`auth`**: Manages user authentication and effective journal restrictions.
*   **`ui`**: Controls UI-related aspects such as **`sliderOrder`**, visibility, and the crucial **`isCreating`** boolean that toggles between Standard and Document Creation modes.
*   **`selections`**: Stores the currently selected single entities (e.g., `selectedJournalId`, `selectedPartnerId`).
*   **`documentCreationState`**: A dedicated slice that becomes active when `isCreating` is `true`. It manages the state for new documents, including **locked entities** (like `lockedPartnerIds` or `lockedGoodIds` which can be arrays) and the items to be included in the final document(s).

### 3.2. Data Fetching and Query Management (`src/hooks/useChainedQuery.ts`)

Data fetching is centralized and managed by `TanStack Query` via the `useChainedQuery` hook. This hook is the brain of the data flow, constructing the correct query for each slider based on its type, its position in the `sliderOrder`, and the current application mode (`isCreating`).

#### Core Principles of Data Fetching:

*   **Chained Dependencies:** Data in a slider is filtered by selections made in *preceding* visible sliders.
*   **Mode-Dependent Logic:** The query function, its parameters, and its `enabled` state change dramatically depending on whether `isCreating` is `true` or `false`.
*   **Contextual UI:** The application isn't just a data browser; it transforms into a guided workflow tool when `isCreating` is `true`, with the `sliderOrder` defining the steps of that workflow.


### 3.3. Journal Slider - Advanced Filtering and Selection

The Journal slider is not a simple list but a powerful hierarchical selection tool with its own state management and interaction logic. The selections made here, combined with a chosen filter mode, fundamentally dictate the data available to all subsequent sliders in the chain.

#### 3.3.1. Journal Filter Modes

The Journal slider operates with a strict **3-level hierarchy structure** where level selection follows specific rules:

**Hierarchy Structure:**
- **Level 0 (Hidden/Root):** Not selectable in UI, but always included when present
- **Level 1 (1st Row):** Selectable parent journals (e.g., 2, 3, 4)
- **Level 2 (2nd Row):** Selectable child journals (e.g., 20, 21, 31, 32)

**Selection Rules:**
1. **Level 0** is never directly selectable but is automatically included if user has a restricted journal
2. **Level 1** must be selected to enable Level 2 visibility - no skipping allowed
3. **Level 2** is only visible when corresponding Level 1 items are selected
4. **Empty Selection Rule:** If no Level 1 items are selected, return nothing

**User Context:**
- **Admin Users:** Level 0 can be empty (unrestricted access)
- **Restricted Users:** Level 0 is always their `restrictedTopLevelJournalId`

When the Journal slider is the first active slider in the `sliderOrder`, the user can select one of three filtering modes:

*   **`affected` (Default Mode):** Returns entities linked to complete hierarchy paths. Level 0 + Level 1 + Level 2 (if selected) are combined with AND logic. Different Level 1 branches are combined with OR logic.
    *   **Basic Example:** Level 1 items `[2, 3]` with Level 2 items `[20, 21, 31, 32]` returns: `(Level0 AND 2 AND (20 OR 21)) OR (Level0 AND 3 AND (31 OR 32))`
    *   **Deep Path Example:** If hierarchy has 3 levels and Level 2 items `[201, 202, 211, 213]` are selected: `(Level0 AND 2 AND 20 AND (201 OR 202)) OR (Level0 AND 2 AND 21 AND (211 OR 213))`

*   **`unaffected`:** Returns entities that belong to parent paths but are NOT linked to the deepest selected level in each branch.
    *   **Example:** With Level 1 `[2, 3]` and Level 2 `[20, 21, 31, 32]` selected returns: `(Level0 AND 2 AND NOT (20 OR 21)) OR (Level0 AND 3 AND NOT (31 OR 32))`
    *   **Deep Example:** With 3 levels returns: `(Level0 AND 2 AND 20 AND NOT (201 OR 202)) OR (Level0 AND 2 AND 21 AND NOT (211 OR 213))`

*   **`inProcess`:** Functions identically to `affected` but adds `status = PENDING` condition for entities with approval workflows.
    *   **Example:** Same logic as `affected` plus `AND status = PENDING`

**Critical Rules:**
- If no Level 1 items are selected → return empty results
- Level 2 items are only visible when their parent Level 1 item is selected
- Cannot skip levels in the hierarchy
- Level 0 is implicit based on user permissions

#### 3.3.2. Hierarchical Selection Interaction Logic

The Journal slider's UI is designed for complex, multi-level selections. Its behavior is governed by the following principles:

##### A. General Principles & State

*   **Navigation:** Double-clicking an item with children drills down into that level. Double-clicking the main context display (e.g., `ROOT - All Accounts`) navigates up one level.
*   **Manual Selection Priority:** Any manual click on a journal item (`L1` or `L2`) creates a "custom saved state" for the current view, which can be restored later.
*   **State Persistence:** The system maintains two types of saved selections:
    1.  **Top-Level Saved State:** A snapshot of a custom selection for an entire view (e.g., within `ROOT`).
    2.  **L1-Item Saved State:** A snapshot of selected children (`L2` items) for a specific `L1` parent.

##### B. Top-Level Control Button Interaction

The split button at the top of the slider provides global actions via its dropdown menu. Using any of these actions resets the internal click-cycle state of all individual `L1` items.

*   **Restore Last Selection:** Restores the saved custom selection for the current view.
*   **Select All Visible:** Expands all `L1` parents and selects every visible `L1` and `L2` item.
*   **Select Parents Only:** Expands and selects all `L1` parents while deselecting all their `L2` children.
*   **Clear All Selections:** Deselects every item. This does not erase the persistent saved state, which can still be restored.

##### C. L1 Item Interaction (Top-level items with children)

*   **Double Click:** Navigates into that item, making it the new context view.
*   **Single-Click Cycle:** A single click on an `L1` item with children cycles through the following states in order:
    1.  **Restore Saved Selection:** Restores the specific `L2` children that were previously saved for this `L1` parent (if any exist).
    2.  **Children Visible, All Selected:** Expands the `L2` grid and selects all children.
    3.  **Children Visible, Parent Selected:** Keeps the `L2` grid visible but deselects all children, selecting only the `L1` parent itself.
    4.  **Children Hidden, Parent Selected:** Collapses the `L2` grid, leaving only the `L1` parent selected.
    5.  **Unselected:** Deselects the `L1` parent and collapses its children.

##### D. L2 Item Interaction (Child items)

*   **Single Click:** Toggles the selection state of the `L2` item. This action immediately updates both the **L1-item's saved state** and the **top-level saved state**.
*   **Double Click:** A navigation shortcut. It navigates up to the parent `L1` view and applies a filter to show only the `L2` item that was just double-clicked.

The final output of these interactions is a set of `selectedJournalIds` and a `filterMode`, which are then consumed by the `useChainedQuery` hook to build the precise queries for the subsequent Partner and Goods sliders.

---

## 4. Fetching Scenarios and Slider Order Logic

The behavior of the sliders is best understood by analyzing the permutations of their order, especially the position of the **Document (D)** slider.

### A. Standard Mode (`isCreating: false`)

In this mode, the application functions as a powerful data exploration tool. The Document slider, like all others, acts as a filter sink, showing existing documents that match the criteria selected in any preceding sliders. Additionally, when a document is selected, it filters subsequent sliders to show only entities contained within that document.

*   **General Rule:** Each slider fetches data filtered by the selections (`selectedJournalId`, `selectedPartnerId`, etc.) in all sliders that appear *before* it in the `sliderOrder`.
*   **Document Filtering:** When a document is selected, subsequent sliders show only the entities that are linked to that document through the DocumentLine table.
*   **Example (`P → G → D → J`):**
    *   **Partner (P):** Fetches all available partners.
    *   **Goods (G):** Fetches goods related to the `selectedPartnerId`.
    *   **Document (D):** Fetches documents that match the selected Partner and Good.
    *   **Journal (J):** If a document is selected, shows only journals that appear in that specific document; otherwise shows journals related to the Partner and Good selections.

### B. Document Creation Mode (`isCreating: true`)

This mode transforms the UI into a guided wizard for creating documents. The position of the Document slider is **critical** as it dictates the workflow, what entities get "locked," and whether single or multiple documents are created. In this mode, the Document slider is disabled and subsequent sliders ignore any previous document selections to allow creation of new entity combinations.

*   **Key Concept:** The Document (D) slider acts as a "commit" or "lock" point. Selections made in sliders *before* 'D' become the locked context for the document. Sliders *after* 'D' are then used to select the contents of the document(s), often with multi-select capabilities.
*   **Document Slider Behavior:** In creation mode, the Document slider is always disabled and shows no data. This prevents circular dependency issues where users would be limited to entities already in existing documents.
*   **Mode-Aware Filtering:** The filtering system completely ignores document selections when `isCreating: true`, allowing subsequent sliders to show all available entities rather than being constrained by existing document contents.

---

## 5. Slider Order Permutations and Detailed Behavior

Here are the primary permutations and their distinct behaviors in both modes. We will focus on Journal (J), Partner (P), Goods (G), and Document (D).

#### **1. Order: J → P → G → D**

*   **Standard Mode (`isCreating: false`):**
    *   Standard hierarchical filtering. Selecting a Journal filters Partners, selecting a Partner filters Goods, and all three selections filter the list of existing Documents.
*   **Document Creation Mode (`isCreating: true`):**
    *   **Workflow:** This is the simplest creation flow, designed for making a single document with one of each entity.
    *   **Behavior:** The user selects a single Journal, a single Partner, and a single Good. The 'Create Document' action uses these three selections to generate one new document. Multi-selection is disabled.

#### **2. Order: J → P → D → G (Partner Locked Mode)**

*   **Standard Mode (`isCreating: false`):**
    *   Selecting a Journal filters Partners. Selections from both J and P filter the Document list. If a document is selected, the Goods slider shows only goods contained in that document; otherwise shows goods related to J and P selections.
*   **Document Creation Mode (`isCreating: true`):**
    *   **Workflow:** **Lock-in a Partner to create one document with multiple goods.**
    *   **Behavior:**
        1.  User selects a Journal (e.g., "Sales Invoices").
        2.  User selects a Partner (e.g., "Client A"). This partner is now considered **locked**.
        3.  The Document slider (D) is disabled and shows no data.
        4.  The **Partner slider becomes locked** (shows selected partner but cannot be swiped).
        5.  The **Goods (G) slider** appears, showing all goods available for the locked partner. It functions as a **multi-select list**.
        6.  The user can select multiple goods with price and quantity. The 'Create Document' action generates **one new document** for "Client A" containing all selected goods.
        7.  **Validation:** Standard validation modal before document creation.

#### **3. Order: J → G → D → P (Goods Locked Mode)**

*   **Standard Mode (`isCreating: false`):**
    *   Similar to the above, but the dependency is on Goods first. Selecting J filters G. Selections from J and G filter the Document list. If a document is selected, the Partner slider shows only partners in that document; otherwise shows partners related to J and G selections.
*   **Document Creation Mode (`isCreating: true`):**
    *   **Workflow:** **Lock-in a Good to create multiple documents, one for each selected partner.**
    *   **Behavior:**
        1.  User selects a Journal.
        2.  User selects a single Good (e.g., "Consulting Hour"). This good is now considered **locked**.
        3.  The Document slider (D) is disabled and shows no data.
        4.  The **Goods slider becomes locked** (shows selected good but cannot be swiped).
        5.  The **Partner (P) slider** appears, showing all partners associated with the locked good. It functions as a **multi-select list**.
        6.  The user can select multiple partners (e.g., "Client A", "Client B"). The 'Create Documents' action generates **multiple new documents**: one for "Client A" with "Consulting Hour", and another for "Client B" with "Consulting Hour".
        7.  **Validation:** Multiple document creation workflow.

#### **4. Order: J → D → P → G (Multiple Partners, Intersection Goods)**

*   **Standard Mode (`isCreating: false`):**
    *   Selecting a Journal filters Documents, Partners, and Goods independently. If a document is selected, both Partner and Goods sliders show only entities contained in that document.
*   **Document Creation Mode (`isCreating: true`):**
    *   **Workflow:** **Select multiple partners, then find their common goods (intersection).**
    *   **Behavior:**
        1.  User selects a Journal and immediately enters the document creation context.
        2.  The Document slider (D) is disabled and shows no data.
        3.  The **Partner (P) slider** appears as a **multi-select list**. The user selects one or more partners.
        4.  The **Goods (G) slider** dynamically updates its query. It fetches and displays only the goods that are common to (**the intersection of**) *all* selected partners.
        5.  The user can then select goods from this intersection list. The system will create **N documents** (one per selected partner), each containing the selected intersected goods.
        6.  **Logic:** Only goods that are linked to every selected partner are shown.

#### **5. Order: J → D → G → P (Multiple Goods, Intersection Partners)**

*   **Standard Mode (`isCreating: false`):**
    *   Selecting a Journal filters Documents, Goods, and Partners independently. If a document is selected, both Goods and Partners sliders show only entities contained in that document.
*   **Document Creation Mode (`isCreating: true`):**
    *   **Workflow:** **Select multiple goods, then find the partners common to all of them (intersection).**
    *   **Behavior:**
        1.  User selects a Journal and enters the creation context.
        2.  The Document slider (D) is disabled and shows no data.
        3.  The **Goods (G) slider** appears as a **multi-select list**. The user selects one or more goods.
        4.  The **Partner (P) slider** dynamically updates. It fetches and displays only the partners who are associated with *all* of the selected goods (**intersection**).
        5.  The user can select partners from this filtered list. The system will create **N documents** (one per intersected partner), each containing the selected goods.
        6.  **Logic:** Only partners that are linked to every selected good are shown.

---

## 6. Document Slider Implementation Details

### 6.1. Slider Locking System
- When an entity type appears before Document in the slider order, that slider becomes "locked" during document creation
- Locked sliders display the selected entity but prevent navigation/swiping
- User can still see the selection but cannot change it during document creation

### 6.2. Intersection Logic
- When Document appears first (J→D→P→G or J→D→G→P), subsequent sliders show intersections
- **Partner Intersection:** Partners who have access to ALL selected goods
- **Goods Intersection:** Goods that are available to ALL selected partners
- This ensures document creation only includes valid entity combinations

### 6.3. Multiple Document Creation
- When multiple entities are selected before Document position, multiple documents are created
- Each document contains one instance of the "variable" entity (partner or good)
- All documents share the same "fixed" entities from earlier slider selections

### 6.4. Mode-Aware Filtering Implementation
The filtering system in `useChainedQuery.ts` implements mode-aware behavior:

**In Standard Mode (`isCreating: false`):**
- Document slider affects subsequent sliders normally
- Subsequent sliders filter by document content when document comes before them
- Enables exploration of existing document contents

**In Document Creation Mode (`isCreating: true`):**
- Document slider is disabled/invisible and shows no data
- Subsequent sliders ignore any document selections completely
- Filtering works as if Document slider doesn't exist
- Prevents circular dependency issues in document creation workflows

This architecture demonstrates a highly flexible and powerful system where the user interface and underlying data logic adapt in real-time to the user's configured workflow, represented by the `sliderOrder` and the `isCreating` state.