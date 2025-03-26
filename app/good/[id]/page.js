"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import PartnerSlider from "../../components/PartnerSlider";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

const goods = [
  {
    id: 1,
    name: "Enterprise Laptop Pro",
    description: "High-performance laptop for business professionals.",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80",
    inStock: 45,
    partnerId: 1,
  },
  {
    id: 2,
    name: "Wireless Headphones",
    description: "Premium noise-canceling headphones for clear communication.",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80",
    inStock: 7,
    partnerId: 1,
  },
  {
    id: 3,
    name: "Cloud Server Package",
    description: "Scalable cloud server solution for enterprise applications.",
    image:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80",
    inStock: 12,
    partnerId: 2,
  },
  {
    id: 4,
    name: "Data Analytics Suite",
    description: "Comprehensive data analysis and visualization tools.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80",
    inStock: 25,
    partnerId: 2,
  },
  {
    id: 5,
    name: "Cloud Storage Solution",
    description: "Secure and scalable cloud storage for businesses.",
    image:
      "https://images.unsplash.com/photo-1614624532983-4ce03382d63d?auto=format&fit=crop&q=80",
    inStock: 30,
    partnerId: 3,
  },
];

const partners = [
  {
    id: 1,
    name: "TechCorp Solutions",
    description: "Leading provider of enterprise technology solutions",
    image:
      "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&q=80",
  },
  {
    id: 2,
    name: "DataFlow Systems",
    description: "Specialized in data management and analytics",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80",
  },
  {
    id: 3,
    name: "CloudNet Services",
    description: "Cloud infrastructure and storage solutions",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80",
  },
];

export default function GoodPage({ params }) {
  const good = goods.find((g) => g.id === parseInt(params.id));
  const [currentPartnerIndex, setCurrentPartnerIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!good) return <div>Good not found</div>;

  const goodOwners = partners;

  const handlePartnerChange = (index) => {
    setCurrentPartnerIndex(index);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={styles.container}>
      <div className={styles.navigation}>
        <button
          onClick={() => window.history.back()}
          className={styles.backButton}
        >
          ← Back
        </button>
        <h1 className={styles.header}>Detailed Owners</h1>
      </div>
      <div className={styles.goodDisplay}>
        <Image
          src={good.image}
          alt={good.name}
          width={300}
          height={200}
          className={styles.goodImage}
        />
        <h2>{good.name}</h2>
        <button className={styles.toggleButton} onClick={toggleExpand}>
          {isExpanded ? (
            <>
              <FaChevronUp /> Hide Details
            </>
          ) : (
            <>
              <FaChevronDown /> Show Details
            </>
          )}
        </button>
        <div
          className={`${styles.description} ${
            isExpanded ? styles.expanded : ""
          }`}
        >
          <p>{good.description}</p>
          <span className={styles.stock}>In Stock: {good.inStock} units</span>
        </div>
      </div>
      <h3 className={styles.ownersTitle}>Available Partners</h3>
      <PartnerSlider onPartnerChange={handlePartnerChange} />
    </div>
  );
}
