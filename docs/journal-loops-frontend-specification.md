# Journal Loops Feature - Frontend Specification

## Overview

The Journal Loops feature allows users to create named loops of journal entries that form closed accounting circuits. Each loop represents a series of journal-to-journal transactions where credits and debits flow in a circular pattern, eventually returning to the starting journal.

## Core Concepts

### Loop Structure
- A loop consists of 3 or more journals connected in sequence
- The final journal in the sequence links back to the first journal, creating a closed circuit
- Each connection represents a transaction flow (credit from one journal, debit to the next)
- Example: Journal 5 → Journal 7 → Journal 314 → Journal 211 → Journal 5

### Journal Linking Rules
- **Multi-Link Journals**: Some journals can participate in multiple loops (e.g., Journal 5 can link to Journal 7 in Loop A and to Journal 200 in Loop B)
- **Single-Link Journals**: Some journals are restricted to only one outgoing link across all loops
- Journal linking restrictions are determined by journal configuration/type

### Loop Properties
- **Name**: User-defined descriptive name for the loop
- **Path**: Ordered sequence of journals in the loop
- **Status**: Active/Inactive/Draft
- **Created Date**: When the loop was first created
- **Last Modified**: When the loop was last updated

## User Interface Design

### 1. Loop Management Dashboard

#### Main Loop List View
- **Layout**: Card-based grid or list view of all existing loops
- **Loop Card Contents**:
  - Loop name (prominent heading)
  - Loop path preview (abbreviated: "5 → 7 → 314 → 211 → 5")
  - Status badge (Active/Inactive/Draft)
  - Last modified date
  - Quick action buttons (Edit, Delete, Activate/Deactivate)
- **Header Actions**:
  - "Create New Loop" button
  - Search/filter bar for finding loops by name or journal numbers
  - Sort options (Name, Date Created, Last Modified, Status)

#### Loop Detail Modal/Panel
When clicking on a loop card:
- **Vertical Path Display**:
  - Sequential list showing each journal in the loop
  - Visual arrows or connectors between journals
  - Journal names and numbers clearly displayed
  - Credit/Debit indicators for each transaction
- **Loop Information Panel**:
  - Loop name (editable)
  - Creation date and creator
  - Last modification details
  - Status controls
- **Action Buttons**: Edit Loop, Delete Loop

### 2. Loop Creation Interface

#### Step 1: Basic Information
- **Loop Name Input**: Text field for naming the loop
- **Description Field**: Optional longer description of the loop's purpose

#### Step 2: Journal Selection and Ordering
- **Journal Picker Interface**:
  - Search/filter journals by name, number
  - Display journal hierarchy (if applicable)
  - Show linking restrictions (visual indicators for single-link vs multi-link journals)
  - Highlight journals already used in other loops

#### Step 3: Loop Construction
- **Interactive Loop Builder**:
  - Drag-and-drop interface for arranging journals in sequence
  - Visual representation of the forming loop
  - Real-time validation of loop closure
  - Credit/Debit flow visualization
  - Conflict detection for journal linking restrictions

#### Step 4: Validation and Preview
- **Loop Validation Panel**:
  - Check for proper loop closure
  - Verify no journal linking rule violations
  - Display warnings for potential issues
- **Preview Display**:
  - Visual representation of complete loop
  - Transaction flow summary
  - Final confirmation before saving

### 3. Journal Loop Visualization

#### Visual Elements
- **Loop Diagram**: Circular or flowchart representation showing journal connections
- **Flow Indicators**: Arrows showing direction of credit/debit flow
- **Journal Nodes**: Visual representations of each journal with:
  - Journal number and name
  - Current balance (if applicable)
  - Link capacity indicator (single vs multi-link)

#### Interactive Features
- **Hover Effects**: Show transaction details when hovering over connections
- **Click Navigation**: Click on journals to view details or navigate to journal management
- **Zoom Controls**: For complex loops with many journals

### 4. Loop Editing Interface

#### Edit Modes
- **Quick Edit**: Inline editing of loop name and basic properties
- **Advanced Edit**: Full reconstruction interface similar to creation flow
- **Path Modification**: Add/remove journals from existing loops with validation

#### Validation During Editing
- **Real-time Conflict Detection**: Immediate feedback on journal linking violations
- **Dependency Warnings**: Alert when changes might affect other loops
- **Rollback Options**: Ability to revert changes if validation fails

### 5. Integration with Existing Journal Interface

#### Journal Detail View Enhancements
- **Loop Participation Panel**: Show which loops a journal participates in
- **Link Status Display**: Visual indicator of linking capacity (used/available)
- **Loop Navigation**: Quick links to view related loops

#### Journal Slider Integration
- **Loop Filter Option**: Filter journals by loop participation
- **Visual Indicators**: Show loop-participating journals with distinct styling
- **Quick Loop Access**: Contextual menu for accessing loops from journal selection

### 6. Responsive Design Considerations

#### Mobile/Tablet Adaptations
- **Simplified Loop Cards**: Condensed information display for smaller screens
- **Touch-Friendly Creation**: Mobile-optimized drag-and-drop or step-by-step wizard
- **Collapsible Sections**: Expandable sections for loop details and editing

### 7. User Experience Flow

#### Creating a New Loop
1. User clicks "Create New Loop" from dashboard
2. Names the loop and optionally adds description
3. Selects journals using search/filter interface
4. Arranges journals in sequence using drag-and-drop
5. System validates loop closure and linking rules
6. User previews complete loop and confirms creation
7. Loop is saved and added to dashboard

#### Viewing Loop Details
1. User clicks on loop card from dashboard
2. Detail panel opens showing vertical path display
3. User can see complete transaction flow
4. Navigation options to edit or manage the loop

#### Managing Multiple Loops
1. Dashboard provides overview of all loops
2. Search and filter capabilities for finding specific loops
3. Status management for activating/deactivating loops

## Technical Considerations for Frontend Implementation

### State Management
- Loop data structure for managing loop definitions
- Journal linking state to track usage across loops
- Validation state for real-time feedback during creation/editing

### Performance Optimization
- Lazy loading for large numbers of loops
- Efficient rendering for complex loop visualizations
- Caching of journal data for quick loop construction

### Accessibility
- Keyboard navigation for all interactive elements
- Screen reader support for loop visualization
- High contrast mode for visual indicators

### Error Handling
- Graceful handling of validation failures
- Clear error messaging for journal linking conflicts
- Recovery options when loop operations fail

This specification provides a comprehensive foundation for implementing the journal loops feature with a focus on user experience and visual clarity while accommodating the complex business rules around journal linking.