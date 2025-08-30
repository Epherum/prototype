"use client";

import { motion } from "framer-motion";
import UserAuthDisplay from "./UserAuthDisplay";
import styles from "./Header.module.css";

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

interface HeaderProps {
  onOpenCreateUserModal?: () => void;
  showSliderControls?: boolean;
  children?: React.ReactNode;
}

export default function Header({
  onOpenCreateUserModal,
  showSliderControls = false,
  children,
}: HeaderProps) {
  return (
    <motion.div
      className={styles.header}
      variants={headerVariants}
      initial="hidden"
      animate="visible"
    >
      <UserAuthDisplay
        onOpenCreateUserModal={onOpenCreateUserModal || (() => {})}
      />
      {children}
    </motion.div>
  );
}