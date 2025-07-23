# Journal Interaction Logic

## Top-Level Controls Interaction

```mermaid
graph TD
    subgraph "Top-Level User Actions"
        A[User Dbl-Clicks Main Context Display] --> NavUp{Current view is NOT root?};
        B[User Clicks Dropdown Trigger] --> Action{Selects Action};
    end

    subgraph "Navigation Logic"
        NavUp -- Yes --> NavUpAction[Find parent of current topLevelId];
        NavUp -- No --> NoOp1[(No-op)];
        NavUpAction --> CallNav[Call handleSelectTopLevelJournal(parent.id, current_topLevelId)];
    end

    subgraph "Dropdown Action Logic"
        Action -- "Restore Last Selection" --> C{Is a saved state available?<br/>(savedTopLevelSelectionsRef.current[topLevelId])};
        Action -- "Select All Visible" --> D[<b>Select:</b> All L1 items<br/><b>Select:</b> All L2 children of all L1s<br/><b>Visibility:</b> Expand all L1 items];
        Action -- "Select Parents Only" --> E[<b>Select:</b> All L1 items<br/><b>Deselect:</b> All L2 children<br/><b>Visibility:</b> Expand all L1 items];
        Action -- "Clear All Selections" --> F[<b>Deselect:</b> ALL L1 and L2 items<br/><b>Visibility:</b> Collapse all L1 items];
    end

    subgraph "Restore Logic"
        C -- Yes --> G[Read saved L1 & L2 selections<br/>(from savedTopLevelSelectionsRef)<br/>Set visibility based on selection];
        C -- No --> H[(Action is disabled in UI, no-op)];
    end

    subgraph "Final State Update & Side Effects"
        %% This node represents the core requirement from the docs and code
        CommonReset[
            <b>STATE UPDATE:</b><br/>
            Reset L1 Item Click Cycles<br/>
            <i>l1ClickCycleState.current = {}</i>
        ]

        %% All paths lead to the reset, then to the final update
        G --> CommonReset;
        D --> CommonReset;
        E --> CommonReset;
        F --> CommonReset;
        CallNav --> CommonReset;

        CommonReset --> FinalUpdate[Call updateJournalSelections(new_state)];
    end
```

## L1 Item Interaction (Parent & Terminal Nodes)

```mermaid
graph TD
    Start[User interacts with an L1 Item] --> ClickType{Distinguish Single vs. Double Click<br/>(using setTimeout)};

    subgraph "Double-Click Logic"
        ClickType -- Double Click --> IsParent1{Item has children?};
        IsParent1 -- Yes --> DrillDown[
            <b>NAVIGATION:</b><br/>
            Call handleSelectTopLevelJournal(itemId)<br/>
            Resets L1 click cycles for new view
        ];
        IsParent1 -- No --> NoOp2[(Terminal node, no-op)];
    end

    subgraph "Single-Click Logic"
        ClickType -- Single Click --> IsParent2{Item has children?};

        subgraph "Terminal Node Logic (No Children)"
            IsParent2 -- No --> TerminalToggle[
                <b>STATE UPDATE:</b><br/>
                Toggle item selection in <i>level2Ids</i><br/>
                Call _saveTopLevelSnapshot()<br/>
                Call updateJournalSelections()
            ];
        end

        subgraph "Parent Node Cycle Logic (Has Children)"
            IsParent2 -- Yes --> GetState{Get current cycle state for this item<br/>(from l1ClickCycleState.current)};

            GetState --> SwitchState{switch (currentState)};

            SwitchState -- "UNSELECTED" --> CheckSkip{Is item ALREADY in<br/>"All Selected" state?};
            CheckSkip -- Yes --> |Intelligent Skip| State2;
            CheckSkip -- No --> CheckSaved{Has a custom L2 selection been saved?<br/>(savedSelectionsRef.current[itemId])};

            CheckSaved -- Yes --> State0["
                <b>State 0: Restore Saved</b><br/>
                Select L1 Parent<br/>
                Select saved L2 children<br/>
                Make children visible
            "];
            CheckSaved -- No --> State1["
                <b>State 1: All Selected</b><br/>
                Select L1 Parent<br/>
                Select ALL L2 children<br/>
                Make children visible
            "];

            SwitchState -- "RESTORE_SAVED" --> SkipCheck2{Is saved selection same as 'All Children'?};
            SkipCheck2 -- Yes --> |Intelligent Skip| State2;
            SkipCheck2 -- No --> State1;

            SwitchState -- "CHILDREN_VISIBLE_ALL_SELECTED" --> State2["
                <b>State 2: Parent Only Visible</b><br/>
                Select L1 Parent<br/>
                DESELECT all L2 children<br/>
                Keep children visible
            "];
            SwitchState -- "CHILDREN_VISIBLE_NONE_SELECTED" --> State3["
                <b>State 3: Hidden</b><br/>
                Select L1 Parent<br/>
                Hide children
            "];
            SwitchState -- "CHILDREN_HIDDEN" --> State4["
                <b>State 4: Unselected</b><br/>
                Deselect L1 Parent<br/>
                Hide children
            "];

            subgraph "Cycle State Update"
                %% Define a common outcome for all cycle steps
                ApplyUpdate[
                    <b>STATE UPDATE:</b><br/>
                    1. Set new <i>l1ClickCycleState.current[itemId]</i><br/>
                    2. Set new <i>visibleChildrenMap</i><br/>
                    3. Call _saveTopLevelSnapshot()<br/>
                    4. Call updateJournalSelections()
                ]
                State0 --> ApplyUpdate;
                State1 --> ApplyUpdate;
                State2 --> ApplyUpdate;
                State3 --> ApplyUpdate;
                State4 --> ApplyUpdate;
            end
        end
    end
```

## L2 Item Interaction

```mermaid

graph TD
Start[User interacts with an L2 Item] --> ClickType{Distinguish Single vs. Double Click<br/>(using setTimeout)};

    subgraph "Double-Click Logic"
        ClickType -- Double Click --> FindParent[Find parent L1 of the L2 item];
        FindParent --> DrillUp[
            <b>NAVIGATION:</b><br/>
            Call handleSelectTopLevelJournal(parent.id, l2ItemId)<br/>
            (Navigates to parent view & selects the double-clicked item)<br/>
            Resets L1 click cycles for new view
        ];
    end

    subgraph "Single-Click Logic (handleL2SingleClickToggle)"
        ClickType -- Single Click --> ToggleL3[<b>1. Toggle Selection</b><br/>Update <i>level3Ids</i> with this L2 item];

        ToggleL3 --> UpdateParentState[
            <b>2. Update L1 Parent's State</b><br/>
            Find L1 parent<br/>
            Update its custom L2 selection snapshot<br/>
            <i>savedSelectionsRef.current[parent.id] = ...</i>
        ];

        UpdateParentState --> SetNextCycle[
            <b>3. Set Parent's Next Click Behavior</b><br/>
            Set parent's L1 cycle state to RESTORE_SAVED<br/>
            <i>l1ClickCycleState.current[parent.id] = "RESTORE_SAVED"</i>
        ];

        SetNextCycle --> SaveTopLevel[
            <b>4. Save Top-Level Snapshot</b><br/>
            Call _saveTopLevelSnapshot()
        ];

        SaveTopLevel --> FinalUpdate[
            <b>5. Update Global State</b><br/>
            Call updateJournalSelections()
        ];
    end
```
