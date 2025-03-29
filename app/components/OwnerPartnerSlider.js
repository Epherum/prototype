"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./PartnerSlider.module.css";
import { FaLevelUpAlt } from "react-icons/fa";

const partners = [
  {
    id: 1,
    name: "TechCorp Solutions",
    description:
      "Leading provider of innovative technology solutions for enterprise businesses. Specializing in cloud computing and AI-driven applications.",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80",
  },
  {
    id: 2,
    name: "DataSys Inc",
    description:
      "Expert data management and analytics solutions for modern businesses.",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80",
  },
  {
    id: 3,
    name: "CloudTech Partners",
    description: "Cloud infrastructure and digital transformation specialists.",
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80",
  },
];

export default function OwnerPartnerSlider({ partnerId, isVisible = true }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentPartner = partners.findIndex((p) => p.id === partnerId);

  const toggleDescription = () => {
    setIsExpanded((prev) => !prev);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.sliderContainer}>
      <div className={styles.navigationButtons}></div>
      <div className={styles.slider}>
        {partners.map((partner, index) => (
          <div
            key={partner.id}
            className={`${styles.slide} ${
              index === currentPartner ? styles.active : ""
            }`}
            style={{
              transform: `translateX(${(index - currentPartner) * 100}%)`,
            }}
          >
            <Image
              src={partner.image}
              alt={partner.name}
              width={400}
              height={200}
              className={styles.partnerImage}
            />
            <h2>{partner.name}</h2>
            <button
              className={styles.toggleButton}
              onClick={toggleDescription}
              aria-expanded={isExpanded}
            >
              {isExpanded ? "Hide Details" : "Show Details"}
            </button>
            <div
              className={`${styles.description} ${
                isExpanded ? styles.expanded : ""
              }`}
            >
              <p>{partner.description}</p>
            </div>
            <Link href="/" className={styles.levelButton}>
              <FaLevelUpAlt /> Level Up
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
