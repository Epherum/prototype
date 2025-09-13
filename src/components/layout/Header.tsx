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
      
      // Keep header height fixed to prevent layout shift - use transform for minimization
      const isMinimized = isScrolledState && !isAtTopState;
      // Set fixed header heights (use the normal size as the fixed size)
      const fixedHeight = 60 + (8 * 1.5 * 2); // 60px + padding calc(var(--spacing-unit) * 1.5) * 2
      const fixedMobileHeight = 50 + (8 * 1.25 * 2); // 50px + mobile padding
      
      // Set fixed header heights to prevent content jumping
      document.documentElement.style.setProperty('--header-height', `${fixedHeight}px`);
      document.documentElement.style.setProperty('--header-height-mobile', `${fixedMobileHeight}px`);
      
      // Dynamic gap adjustment based on navbar state
      document.documentElement.style.setProperty('--header-buffer', '0px');
      document.documentElement.style.setProperty('--header-buffer-mobile', '0px');
      // Set minimized offset: 0px when normal, -15px when minimized
      document.documentElement.style.setProperty('--header-minimized-offset', isMinimized ? '-15px' : '0px');
      document.documentElement.style.setProperty('--header-minimized-offset-mobile', isMinimized ? '-15px' : '0px');
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