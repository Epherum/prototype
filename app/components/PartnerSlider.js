"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./PartnerSlider.module.css";

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
    image: "https://source.unsplash.com/featured/800x400/?startup,modern",
  },
];

export default function PartnerSlider({ onPartnerChange }) {
  const [currentPartner, setCurrentPartner] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [expandedDescription, setExpandedDescription] = useState(null);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    setTouchEnd(e.touches[0].clientX);
    const offset = touchStart - e.touches[0].clientX;
    setDragOffset(offset);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentPartner < partners.length - 1) {
      setCurrentPartner((prev) => prev + 1);
      onPartnerChange(currentPartner + 1);
    }
    if (isRightSwipe && currentPartner > 0) {
      setCurrentPartner((prev) => prev - 1);
      onPartnerChange(currentPartner - 1);
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragOffset(0);
  };

  const toggleDescription = (partnerId) => {
    setExpandedDescription(
      expandedDescription === partnerId ? null : partnerId
    );
  };

  return (
    <div className={styles.sliderContainer}>
      <div
        className={styles.slider}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: isDragging ? `translateX(${-dragOffset}px)` : "none",
        }}
      >
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
              onClick={() => toggleDescription(partner.id)}
              aria-expanded={expandedDescription === partner.id}
            >
              {expandedDescription === partner.id
                ? "Hide Details"
                : "Show Details"}
            </button>
            <div
              className={`${styles.description} ${
                expandedDescription === partner.id ? styles.expanded : ""
              }`}
            >
              <p>{partner.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.dots}>
        {partners.map((_, index) => (
          <span
            key={index}
            className={`${styles.dot} ${
              index === currentPartner ? styles.activeDot : ""
            }`}
            onClick={() => {
              setCurrentPartner(index);
              onPartnerChange(index);
            }}
          />
        ))}
      </div>
    </div>
  );
}
