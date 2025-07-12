"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/store/appStore";

// Hardcoded data for the projects slider
const MOCK_PROJECTS = [
  { id: "proj_1", name: "Project Phoenix" },
  { id: "proj_2", name: "Project Titan" },
  { id: "proj_3", name: "Project Gemini" },
];

export const useProjectManager = () => {
  // Consume selection state from the global Zustand store
  const selectedProjectId = useAppStore((state) => state.selections.project);
  const setSelection = useAppStore((state) => state.setSelection);

  // Local UI state for managing the "Create Project" modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Local UI state for the (currently non-functional) options menu
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [optionsMenuAnchorEl, setOptionsMenuAnchorEl] =
    useState<HTMLElement | null>(null);

  // Callback to update the global state when a project is selected
  const setSelectedProjectId = useCallback(
    (id: string | null) => {
      // Note: Because the project slider is independent, we don't need to
      // worry about clearing subsequent selections here. The setSelection
      // function in the store is already designed to handle this based on
      // the slider's position in the main `sliderOrder` array.
      setSelection("project", id);
    },
    [setSelection]
  );

  // Handlers for the "Create Project" modal
  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  // Handlers for the options menu
  const openOptionsMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setOptionsMenuAnchorEl(event.currentTarget);
      setIsOptionsMenuOpen(true);
    },
    []
  );

  const closeOptionsMenu = useCallback(() => {
    setIsOptionsMenuOpen(false);
    setOptionsMenuAnchorEl(null);
  }, []);

  return {
    // Data to be displayed in the slider
    projectsForSlider: MOCK_PROJECTS.map((p) => ({
      id: p.id,
      label: p.name, // Format data for the DynamicSlider component
    })),

    // Selection state and handler
    selectedProjectId,
    setSelectedProjectId,

    // Modal state and handlers
    isModalOpen,
    openModal,
    closeModal,

    // Options menu state and handlers
    isOptionsMenuOpen,
    optionsMenuAnchorEl,
    openOptionsMenu,
    closeOptionsMenu,
  };
};
