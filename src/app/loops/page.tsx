//src/app/loops/page.tsx
"use client";

import { motion } from "framer-motion";
import LoopsController from "@/features/loops/LoopsController";
import { useAuthStoreInitializer } from "@/hooks/useAuthStoreInitializer";
import styles from "./page.module.css";

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export default function LoopsPage() {
  useAuthStoreInitializer();

  return (
    <motion.div
      className={styles.pageContainer}
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <LoopsController className={styles.loopsController} />
    </motion.div>
  );
}