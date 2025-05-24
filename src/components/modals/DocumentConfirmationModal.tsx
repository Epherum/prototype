// src/components/modals/DocumentConfirmationModal.js
import { motion } from "framer-motion";

// Import BOTH style modules
import baseStyles from "./ModalBase.module.css"; // Shared modal structure styles
import styles from "./DocumentConfirmationModal.module.css"; // Styles unique to this modal's content

function DocumentConfirmationModal({
  isOpen,
  onClose,
  onValidate,
  partner,
  goods,
}) {
  if (!isOpen) return null;

  const partnerNode = partner;

  return (
    <motion.div
      className={baseStyles.modalOverlay} // ONLY baseStyles for the overlay
      key="doc-confirm-modal-overlay"
      initial="closed"
      animate="open"
      exit="closed"
      variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
      transition={{ duration: 0.2 }}
      style={{ zIndex: 1002 }}
    >
      <motion.div
        className={baseStyles.modalContent} // ONLY baseStyles for the main content shell
        onClick={(e) => e.stopPropagation()}
        key="doc-confirm-modal-content"
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
          className={baseStyles.modalCloseButton} // ONLY baseStyles for the close button
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {/* Use baseStyles.modalTitle if you defined it, or style h2 directly in specificStyles if unique */}
        <h2 className={baseStyles.modalTitle}>Document Confirmation</h2>

        {/* Content specific to this modal, using 'styles' (from DocumentConfirmationModal.module.css) */}
        {partnerNode && (
          <div className={styles.confirmationSection}>
            {" "}
            {/* Use specific 'styles' */}
            <h3>Partner:</h3>{" "}
            {/* Styled by specificStyles.confirmationSection h3 */}
            <p>
              <strong>Name:</strong> {partnerNode.name}
            </p>
            <p>
              <strong>ID:</strong> {partnerNode.id}
            </p>
            {partnerNode.location && (
              <p>
                <strong>Location:</strong> {partnerNode.location}
              </p>
            )}
          </div>
        )}

        {goods && goods.length > 0 && (
          <div className={styles.confirmationSection}>
            {" "}
            {/* Use specific 'styles' */}
            <h3>Selected Goods:</h3>
            <ul className={styles.confirmationGoodsList}>
              {" "}
              {/* Use specific 'styles' */}
              {goods.map((good) => (
                <li key={good.id}>
                  {" "}
                  {/* Styled by specificStyles.confirmationGoodsList li */}
                  <strong>
                    {good.name} ({good.code || good.id})
                  </strong>
                  <p>
                    Qty: {good.quantity}, Price: ${good.price?.toFixed(2)},
                    Amount: $
                    {(typeof good.amount === "number"
                      ? good.amount
                      : 0
                    ).toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Modal actions use baseStyles for the container and button types */}
        <div className={baseStyles.modalActions}>
          <button
            type="button"
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonSecondary}`} // Combine base classes
            onClick={onClose}
          >
            Back to Edit
          </button>
          <button
            type="button"
            onClick={onValidate}
            className={`${baseStyles.modalActionButton} ${baseStyles.modalButtonPrimary}`} // Combine base classes
          >
            Validate Document
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default DocumentConfirmationModal;
