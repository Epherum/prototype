"use client";

import React from "react";
import { motion } from "framer-motion";
import styles from "./page.module.css";

const departments = [
  { id: 1, name: "Top Management" },
  { id: 2, name: "Matrix Operationnelle" },
  { id: 3, name: "Juridique" },
  { id: 4, name: "Logistique" },
  { id: 5, name: "R&D" },
  { id: 6, name: "GRH" },
  { id: 7, name: "Comptabilité" },
  { id: 8, name: "Finance" },
  { id: 9, name: "Magasin" },
  { id: 10, name: "Prod" },
  { id: 11, name: "Achat" },
  { id: 12, name: "Vente" },
  { id: 13, name: "Maintenance" },
  { id: 14, name: "Support" },
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
  const handleDepartmentClick = (department: { id: number; name: string }) => {
    console.log(`Department ${department.id}: ${department.name} clicked`);
    // Add functionality here as needed
  };

  return (
    <div className={styles.container}>
      
      <motion.div
        className={styles.pageHeader}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
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

      <motion.div
        className={styles.imageContainer}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <img 
          src="/departments2.png" 
          alt="Departments Overview" 
          className={styles.departmentImage}
        />
      </motion.div>
    </div>
  );
}