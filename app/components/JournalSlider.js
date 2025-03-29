"use client";

import { useState } from "react";
import styles from "./JournalSlider.module.css";
import {
  FaShoppingCart,
  FaStore,
  FaIndustry,
  FaChartLine,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

const journalTypes = [
  {
    id: 1,
    name: "Buy",
    description: "Purchase goods and raw materials from suppliers.",
    icon: FaShoppingCart,
  },
  {
    id: 2,
    name: "Sell",
    description: "Sell products and services to customers.",
    icon: FaStore,
  },
  {
    id: 3,
    name: "Manufacture",
    description: "Track manufacturing and production processes.",
    icon: FaIndustry,
  },
  {
    id: 4,
    name: "Finance",
    description: "Manage financial transactions and reports.",
    icon: FaChartLine,
  },
];

export default function JournalSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [expandedItem, setExpandedItem] = useState(null);

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

    if (isLeftSwipe && currentIndex < journalTypes.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleMouseDown = (e) => {
    setTouchStart(e.clientX);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setTouchEnd(e.clientX);
    const offset = touchStart - e.clientX;
    setDragOffset(offset);
  };

  const handleMouseUp = () => {
    handleTouchEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleTouchEnd();
    }
  };

  const currentItem = journalTypes[currentIndex];
  const Icon = currentItem.icon;

  return (
    <div className={styles.sliderContainer}>
      <div
        className={styles.slider}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `translateX(${-currentIndex * 100 + (isDragging ? -dragOffset : 0)}%)`,
        }}
      >
        {journalTypes.map((item, index) => {
          const ItemIcon = item.icon;
          return (
            <div key={item.id} className={styles.slide}>
              <div className={styles.goodCard}>
                <div className={styles.iconContainer}>
                  <ItemIcon size={48} />
                </div>
                <h3>{item.name}</h3>
                <button
                  className={styles.descriptionToggle}
                  onClick={() =>
                    setExpandedItem(expandedItem === item.id ? null : item.id)
                  }
                >
                  {expandedItem === item.id ? <FaChevronUp /> : <FaChevronDown />}
                </button>
                {expandedItem === item.id && (
                  <div className={styles.description}>{item.description}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.pagination}>
        {journalTypes.map((_, index) => (
          <div
            key={index}
            className={`${styles.dot} ${index === currentIndex ? styles.activeDot : ""}`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
