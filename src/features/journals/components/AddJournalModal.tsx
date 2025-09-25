// src/components/modals/AddJournalModal.js
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { IoAddCircleOutline } from "react-icons/io5";
import { useQuery } from "@tanstack/react-query";

import baseStyles from "@/features/shared/components/ModalBase.module.css"; // Assuming shared base styles
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { LoopIntegrationSection, LoopIntegrationData } from "./LoopIntegrationSection";
import { fetchJournalHierarchy } from "@/services/clientJournalService";
import { journalKeys } from "@/lib/queryKeys";

import specificStyles from "./AddJournalModal.module.css"; // Styles unique to AddJournalModal form

function AddJournalModal({ isOpen, onClose, onSubmit, context }) {
  // Handle body scroll lock
  useBodyScrollLock(isOpen);
  
  const [newCodeSuffix, setNewCodeSuffix] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [loopIntegrationData, setLoopIntegrationData] = useState<LoopIntegrationData | null>(null);

  // ... (rest of your existing logic for codePrefixForDisplay, codeSeparator, etc. remains unchanged)
  let codePrefixForDisplay = "";
  let codeSeparator = "";
  let codePatternHint = "";
  let finalCodeForNewAccount = "";

  let currentLevel = 1;
  if (context?.parentCode) {
    if (
      !context.parentCode.includes("-") &&
      context.parentCode.length === 1 &&
      /^\d$/.test(context.parentCode)
    ) {
      currentLevel = 2;
      codePrefixForDisplay = context.parentCode;
      codeSeparator = "";
      codePatternHint = `Enter 2 digits (e.g., "01" for code ${context.parentCode}01)`;
    } else {
      currentLevel = (context.parentCode.match(/-/g) || []).length + 2;
      codePrefixForDisplay = context.parentCode;
      codeSeparator = "-";
      codePatternHint = `Enter 1 or 2 digits (e.g., "1" or "01" for code ${context.parentCode}-01)`;
    }
  } else {
    currentLevel = 1;
    codePatternHint = `Enter a single digit (1-9)`;
  }

  // Fetch available journals for loop integration
  const { data: availableJournals = [] } = useQuery({
    queryKey: journalKeys.hierarchy(null),
    queryFn: () => fetchJournalHierarchy(null),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen, // Only fetch when modal is open
  });

  // Flatten journal hierarchy for dropdown
  const flatJournals = availableJournals.reduce((acc, journal) => {
    const flattenJournal = (j: any): Array<{ id: string; name: string; code: string }> => {
      const result = [{ id: j.id, name: j.name, code: j.code || j.id }];
      if (j.children) {
        j.children.forEach((child: any) => {
          result.push(...flattenJournal(child));
        });
      }
      return result;
    };
    return [...acc, ...flattenJournal(journal)];
  }, [] as Array<{ id: string; name: string; code: string }>);

  useEffect(() => {
    if (isOpen) {
      setNewCodeSuffix("");
      setNewName("");
      setError("");
      setLoopIntegrationData(null); // Reset loop integration data
      setTimeout(() => {
        document.getElementById("newJournalCodeSuffix")?.focus();
      }, 100);
    }
  }, [isOpen, context]);

  const handleSubmit = (e) => {
    // ... (handleSubmit logic remains unchanged)
    e.preventDefault();
    setError("");
    const trimmedSuffix = newCodeSuffix.trim();
    const trimmedName = newName.trim();

    if (!trimmedSuffix || !trimmedName) {
      setError("Code Suffix and Name fields are required.");
      return;
    }

    if (currentLevel === 1) {
      if (!/^[1-9]$/.test(trimmedSuffix)) {
        setError("Top-level code must be a single digit (1-9).");
        return;
      }
      finalCodeForNewAccount = trimmedSuffix;
    } else if (currentLevel === 2 && !context.parentCode.includes("-")) {
      if (!/^\d{2}$/.test(trimmedSuffix)) {
        setError(
          `Level 2 code suffix (after "${codePrefixForDisplay}") must be exactly two digits. e.g., "01"`
        );
        return;
      }
      finalCodeForNewAccount = codePrefixForDisplay + trimmedSuffix;
    } else {
      if (!/^\d{1,2}$/.test(trimmedSuffix)) {
        setError(
          `Code suffix (after "${codePrefixForDisplay}${codeSeparator}") must be one or two digits. e.g., "1" or "01"`
        );
        return;
      }
      finalCodeForNewAccount =
        codePrefixForDisplay + codeSeparator + trimmedSuffix;
    }

    const newAccountId = finalCodeForNewAccount;
    const journalData = {
      id: newAccountId,
      code: finalCodeForNewAccount,
      name: trimmedName,
      children: [],
      loopIntegration: loopIntegrationData, // Include loop integration data
    };

    onSubmit(journalData);
    onClose();
  };

  if (!isOpen) return null;

  let title = "Add New Journal Account";
  if (context) {
    // ... (title logic remains unchanged)
    if (context.level === "top" || !context.parentCode) {
      title = "Add New Top-Level Category";
    } else {
      const parentDisplayName = context.parentName
        ? `${context.parentCode} - ${context.parentName}`
        : context.parentCode || context.parentId;
      title = `Add Sub-Account to "${parentDisplayName}"`;
    }
  }

  return (
    <motion.div
      className={baseStyles.modalOverlay} // Use baseStyles
      key="add-journal-modal-overlay"
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{ zIndex: 3000 }} // Much higher than JournalModal to appear on top
    >
      <motion.div
        className={baseStyles.modalContent} // Use baseStyles
        onClick={(e) => e.stopPropagation()}
        key="add-journal-modal-content"
        variants={{
          open: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { delay: 0.05, duration: 0.25 },
          },
          closed: {
            opacity: 0,
            scale: 0.95,
            y: "5%",
            transition: { duration: 0.2 },
          },
        }}
      >
        <button
          className={baseStyles.modalCloseButton} // Use baseStyles
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className={baseStyles.modalTitle}>{title}</h2>{" "}
        {/* Use baseStyles for common title */}
        {/* Form specific content, using specificStyles */}
        <form onSubmit={handleSubmit} className={specificStyles.addJournalForm}>
          {error && <p className={specificStyles.formError}>{error}</p>}
          <div className={specificStyles.formGroup}>
            <label htmlFor="newJournalCodeSuffix">
              Account Code{" "}
              {currentLevel > 1
                ? `Suffix (after "${codePrefixForDisplay}${codeSeparator}")`
                : ""}{" "}
              :
            </label>
            <input
              type="text"
              id="newJournalCodeSuffix" // ID for label and focus
              value={newCodeSuffix}
              onChange={(e) => setNewCodeSuffix(e.target.value)}
              placeholder={codePatternHint}
              required
              aria-describedby={error ? "formErrorText" : undefined}
              // Input styling comes from specificStyles.formGroup input defined in AddJournalModal.module.css
            />
            {currentLevel > 1 && (
              <small className={specificStyles.inputHint}>
                {" "}
                {/* If you have an inputHint style */}
                Full Code Preview: {codePrefixForDisplay}
                {codeSeparator}
                {newCodeSuffix ||
                  (currentLevel === 2 && !context.parentCode.includes("-")
                    ? "XX"
                    : "X")}
              </small>
            )}
          </div>
          <div className={specificStyles.formGroup}>
            <label htmlFor="newJournalName">Account Name:</label>
            <input
              type="text"
              id="newJournalName" // ID for label
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Advertising Campaign"
              required
              aria-describedby={error ? "formErrorText" : undefined}
            />
          </div>

          {/* Loop Integration Section */}
          <LoopIntegrationSection
            onLoopDataChange={setLoopIntegrationData}
            availableJournals={flatJournals}
          />

          {/* Modal actions use baseStyles */}
          <div
            className={baseStyles.modalActions}
            style={{ marginTop: "var(--spacing-unit)" }} // This specific marginTop can stay or be moved to specificStyles.addJournalForm .modalActions if preferred
          >
            <button
              type="button"
              className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`}
            >
              <IoAddCircleOutline /> Add Account
            </button>
          </div>
        </form>
        {error && (
          <div id="formErrorText" role="alert" style={{ display: "none" }}>
            {error}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default AddJournalModal;
