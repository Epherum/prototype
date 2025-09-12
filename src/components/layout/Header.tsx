"use client";

import { useState, useEffect } from "react";
import UserAuthDisplay from "./UserAuthDisplay";
import styles from "./Header.module.css";

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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const threshold = 50;
      const topThreshold = 20;
      
      const isScrolledState = scrollTop > threshold;
      const isAtTopState = scrollTop <= topThreshold;
      
      setIsScrolled(isScrolledState);
      setIsAtTop(isAtTopState);
      
      // Update CSS variables for dynamic header height - add actual header height
      const isMinimized = isScrolledState && !isAtTopState;
      // Calculate actual header heights including padding
      const normalHeight = 60 + (8 * 1.5 * 2); // 60px + padding calc(var(--spacing-unit) * 1.5) * 2
      const minimizedHeight = 36 + (8 * 0.75 * 2); // 36px + padding calc(var(--spacing-unit) * 0.75) * 2
      const normalMobileHeight = 50 + (8 * 1.25 * 2); // 50px + mobile padding
      const minimizedMobileHeight = 30 + (8 * 0.5 * 2); // 30px + minimized mobile padding
      
      document.documentElement.style.setProperty('--header-height', isMinimized ? `${minimizedHeight}px` : `${normalHeight}px`);
      document.documentElement.style.setProperty('--header-height-mobile', isMinimized ? `${minimizedMobileHeight}px` : `${normalMobileHeight}px`);
      
      // Update buffer sizes for sticky header controls
      document.documentElement.style.setProperty('--header-buffer', isMinimized ? '20px' : '5px');
      document.documentElement.style.setProperty('--header-buffer-mobile', isMinimized ? '20px' : '5px');
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`${styles.header} ${isScrolled && !isAtTop ? styles.headerMinimized : ''}`}
      style={{ viewTransitionName: 'main-header' }}
    >
      <UserAuthDisplay
        onOpenCreateUserModal={onOpenCreateUserModal || (() => {})}
        isMinimized={isScrolled && !isAtTop}
      />
      {children && (
        <div className={`${styles.headerContent} ${isScrolled && !isAtTop ? styles.headerContentMinimized : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}