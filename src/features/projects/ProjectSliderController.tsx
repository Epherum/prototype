"use client";

import React from "react";
import { IoOptionsOutline, IoAdd } from "react-icons/io5";
import styles from "@/app/page.module.css";
import { SLIDER_TYPES } from "@/lib/constants";

import { useProjectManager } from "./useProjectManager";
import ProjectsOptionsMenu from "./components/ProjectsOptionsMenu";
import ManageProjectModal from "./components/ManageProjectModal";
import DynamicSlider from "@/features/shared/components/DynamicSlider";

interface LayoutControlProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isMoveDisabled: boolean;
}

export const ProjectSliderController: React.FC<LayoutControlProps> = ({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isMoveDisabled,
}) => {
  const {
    projectsForSlider,
    selectedProjectId,
    setSelectedProjectId,
    isModalOpen,
    openModal,
    closeModal,
    isOptionsMenuOpen,
    optionsMenuAnchorEl,
    openOptionsMenu,
    closeOptionsMenu,
  } = useProjectManager();

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.controlsLeftGroup}>
          <button
            onClick={openOptionsMenu}
            className={`${styles.controlButton} ${styles.editButton}`}
            aria-label="Options for Project"
          >
            <IoOptionsOutline />
          </button>
          <button
            onClick={openModal}
            className={`${styles.controlButton} ${styles.createButton}`}
            aria-label="Create new project"
          >
            <IoAdd /> Create Project
          </button>
        </div>

        <div className={styles.moveButtonGroup}>
          {canMoveUp && (
            <button
              onClick={onMoveUp}
              className={styles.controlButton}
              disabled={isMoveDisabled}
            >
              ▲ Up
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={onMoveDown}
              className={styles.controlButton}
              disabled={isMoveDisabled}
            >
              ▼ Down
            </button>
          )}
        </div>
      </div>

      <DynamicSlider
        sliderId={SLIDER_TYPES.PROJECT}
        title="Project"
        data={projectsForSlider}
        onSlideChange={setSelectedProjectId}
        activeItemId={selectedProjectId}
        isAccordionOpen={false}
        onToggleAccordion={() => {}}
        isLoading={false}
        isError={false}
        placeholderMessage="No projects available."
      />

      <ProjectsOptionsMenu
        isOpen={isOptionsMenuOpen}
        onClose={closeOptionsMenu}
        anchorEl={optionsMenuAnchorEl}
        selectedProjectId={selectedProjectId}
        onAdd={openModal}
        onEdit={() => {}}
        onDelete={() => {}}
      />

      <ManageProjectModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={() => {}}
      />
    </>
  );
};
