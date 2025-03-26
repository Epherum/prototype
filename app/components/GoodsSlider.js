"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./GoodsSlider.module.css";
import Link from "next/link";
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

export default function GoodsSlider({ partnerId, isVisible }) {
  const [currentGoodIndex, setCurrentGoodIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragButtonPressed, setIsDragButtonPressed] = useState(false);
  const [expandedGood, setExpandedGood] = useState(null);

  const partnerGoods = goods.filter((good) => good.partnerId === partnerId);

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

    if (isLeftSwipe && currentGoodIndex < partnerGoods.length - 1) {
      setCurrentGoodIndex((prev) => prev + 1);
    }
    if (isRightSwipe && currentGoodIndex > 0) {
      setCurrentGoodIndex((prev) => prev - 1);
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleDragStart = () => {
    setIsDragButtonPressed(true);
  };

  const handleDragEnd = () => {
    setIsDragButtonPressed(false);
  };

  const toggleExpand = (goodId) => {
    setExpandedGood(expandedGood === goodId ? null : goodId);
  };

  if (!isVisible) return null;

  return (
    <div className={styles.goodsSliderContainer}>
      <div
        className={styles.goodsSlider}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: isDragging ? `translateX(${-dragOffset}px)` : "none",
        }}
      >
        {partnerGoods.map((good, index) => (
          <div
            key={good.id}
            className={`${styles.goodSlide} ${
              index === currentGoodIndex ? styles.active : ""
            }`}
            style={{
              transform: `translateX(${(index - currentGoodIndex) * 100}%)`,
            }}
          >
            <Image
              src={good.image}
              alt={good.name}
              width={300}
              height={200}
              className={styles.goodImage}
            />

            <h3>{good.name}</h3>
            <button
              className={styles.toggleButton}
              onClick={() => toggleExpand(good.id)}
            >
              {expandedGood === good.id ? (
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
                expandedGood === good.id ? styles.expanded : ""
              }`}
            >
              <p>{good.description}</p>
              <span className={styles.stock}>
                In Stock: {good.inStock} units
              </span>
            </div>
            <Link href={`/good/${good.id}`} className={styles.viewOwnersButton}>
              View Owners
            </Link>
          </div>
        ))}
      </div>
      <div className={styles.dots}>
        {partnerGoods.map((_, index) => (
          <span
            key={index}
            className={`${styles.dot} ${
              index === currentGoodIndex ? styles.activeDot : ""
            }`}
            onClick={() => setCurrentGoodIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
