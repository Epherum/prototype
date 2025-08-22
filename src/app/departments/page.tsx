"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const departments = [
  { id: 0, name: "Top Management" },
  { id: 1, name: "Matrix Operationnelle" },
  { id: 2, name: "Juridique" },
  { id: 3, name: "Logistique" },
  { id: 4, name: "R&D" },
  { id: 5, name: "GRH" },
  { id: 6, name: "Comptabilité" },
  { id: 7, name: "Finance" },
  { id: 8, name: "Magasin" },
  { id: 9, name: "Prod" },
  { id: 10, name: "Achat" },
  { id: 11, name: "Vente" },
  { id: 12, name: "Maintenance" },
  { id: 13, name: "Support" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function DepartmentsPage() {
  const router = useRouter();

  const handleDepartmentClick = (department: { id: number; name: string }) => {
    console.log(`Department ${department.id}: ${department.name} clicked`);
    // Add functionality here as needed
  };

  const handleBackClick = () => {
    router.back();
  };

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <button onClick={handleBackClick} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={styles.title}>Departments</h1>
      </motion.div>

      <motion.div
        className={styles.departmentGrid}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {departments.map((department) => (
          <motion.button
            key={department.id}
            className={styles.departmentCard}
            variants={itemVariants}
            onClick={() => handleDepartmentClick(department)}
            whileHover={{ 
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className={styles.departmentNumber}>
              {department.id}
            </div>
            <div className={styles.departmentName}>
              {department.name}
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}