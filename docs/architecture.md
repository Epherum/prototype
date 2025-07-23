ERP Frontend Application: The Authoritative Developer Guide
Part I: General Application Documentation

Welcome to the team. This document is your complete guide to the application's architecture, conventions, and development patterns. Understanding these principles is essential for contributing effectively and maintaining the quality and scalability of our codebase.

This is a sophisticated, client-side rendered web application (Next.js with a "use client" architecture) that serves as the primary user interface for our ERP system.

Core Concept: Chained Filtering

The application's heart is a dynamic, multi-slider interface. Users configure which business entities (Journals, Partners, Goods, etc.) are displayed as "sliders." A selection made in one slider dynamically filters the content of all subsequent sliders to its right. This "chained filtering" is the core of the user experience, providing a powerful and intuitive way to explore complex data relationships.

All new development must strictly adhere to these four foundational patterns. They ensure a clear separation of concerns, scalability, and maintainability.

Pillar 1: Centralized Global State (Zustand)

Location: src/store/appStore.ts

Purpose: The single source of truth for minimal, truly global application state. This is strictly limited to:

The authentication object (user, isAdmin).

The UI layout state (sliderOrder, visibility).

The core entity selections that drive the chained filtering, including the derived effectiveJournalIds.

Convention: Avoid bloating the global store. Feature-specific state belongs in a Manager Hook. All complex, derived state logic (like path-based journal filtering) is centralized within the store's actions to ensure consistency.

Pillar 2: Decentralized Logic (Headless "Manager" Hooks)

Location: src/features/[featureName]/use[FeatureName]Manager.ts

Purpose: Encapsulates all complex business logic, data fetching (via TanStack Query), and feature-specific state for a single feature.

Convention: A manager hook takes zero arguments. It consumes global state from the Zustand store (Pillar 1) and exposes all the data, derived state, and handler functions that its corresponding feature needs to operate.

Pillar 3: Controller Components (The Bridge)

Location: src/features/[featureName]/[FeatureName]Controller.tsx

Purpose: A non-visual or lightly-visual component that orchestrates a feature. It acts as the crucial bridge connecting the headless logic from a Manager Hook (Pillar 2) to the presentational UI components (e.g., modals, sliders).

Convention: A Controller's job is to call its Manager Hook, manage conditional rendering of its child UI components based on the hook's state, and pass the necessary data and handlers down as props.

Pillar 4: Cross-Feature Communication (The "Switchboard" Model)

Location: src/app/page.tsx

Purpose: Manages direct interactions between features, which should be rare but are sometimes necessary.

Convention: The page.tsx file acts as the central "switchboard." We use React.forwardRef on Controller Components to expose imperative methods (e.g., open()). The page holds refs to these controllers and calls these methods directly, making the "command" flow explicit and avoiding complex prop-drilling.

Feature Documentation: Hierarchical Journal Filtering

This document details the interaction logic for the hierarchical Journal selection interface. The system is designed to be powerful yet predictable, with consistent interaction patterns at every level.

Core Interface Components

Split Button Control: A master control at the top of the Journal slider. It consists of two parts:

Main Context Display: Shows the current hierarchy level (e.g., ROOT - All Accounts). Its text and width animate smoothly on change. Its only interaction is a double-click to navigate up one level.

Dropdown Trigger: A chevron icon (▼) that opens a menu of explicit actions. The menu animates in with a staggered effect.

L1 Items (1st Row): The first (left-most) row of journal items, displayed in a horizontal scroller. These can be parent nodes (with children) or terminal nodes (no children).

L2 Items (2nd Row): The second row of journal items, which are children of an expanded L1 parent. These are displayed in a wrapping grid for easy scanning.

State Persistence and Memory

The system manages two types of "saved states," which are persisted in memory for the duration of the user session:

Persistent Top-Level Saved State: For each top-level view (e.g., for "ROOT", for "40 - Expenses"), the system can store one snapshot of a custom selection. This state is created only when a user manually clicks an L1 or L2 item. It is not cleared by the "Clear All Selections" action and is automatically restored if the user navigates back to that view.

L1-Item Saved State: A snapshot of the selected L2 children belonging to a specific L1 parent. This is used to power the "Restore" step in the L1 item's private click cycle.

I. General Principles

Priority of Manual Selection: Any manual click on an L1 or L2 item creates a "custom saved state" for the current top-level view. This enables the "Restore Last Selection" action in the dropdown menu.

Double-Click to Navigate: Double-clicking any item with children drills down, making it the new L1 view. Double-clicking the main context display navigates up one level.

Single-Click on Terminal Nodes: A single click on an item with no children simply toggles its selection state.

II. Top-Level Control Button Interaction

All top-level actions are explicit and discoverable via the split button.

Main Context Display (e.g., ROOT - All Accounts):

Double Click: Navigates up one level in the journal hierarchy.

Dropdown Menu Actions:

Restore Last Selection: Restores the exact custom selection of L1 and L2 items saved for the current view. This option is disabled if no custom selection has been saved.

Select All Visible: Expands all L1 parents and selects every visible L1 and L2 item.

Select Parents Only: Expands all L1 parents, selects them, but deselects all L2 children.

Clear All Selections: Deselects all currently selected items in the view. This does not affect the persistent saved state.

Interaction Note: Using any of these top-level actions resets the internal click-cycle state of all L1 items, ensuring their next click behaves predictably.

III. L1 Item Interaction (for items with children)

This logic provides power-user functionality scoped to a single L1 parent and its L2 children.

Double Click: Navigates into that item, making it the new top-level view.

Single-Click Cycle Logic: A single click cycles through the following states:

Restore Saved Selection (if applicable): The first click, ONLY if a custom selection of its L2 children was previously saved (by manually clicking them).

Children Visible, All Selected: Selects the L1 parent and all of its L2 children. This step is intelligently skipped if the item is already in this state (e.g., after a top-level "Select All").

Children Visible, Parent Selected: Keeps children visible but deselects them, leaving only the L1 parent selected.

Children Hidden, Parent Selected: Collapses the item, hiding its children, but keeps the L1 parent selected.

Unselected (Cycle End): Deselects the L1 parent and all its children.

IV. L2 Item Interaction

Single Click: Toggles the selection of the L2 item. This action immediately creates/updates both the parent L1-item's saved state and the persistent top-level saved state.

Double Click: Navigates up to the parent of the L2 item, making the parent the new top-level view and selecting only the L2 item that was double-clicked.
