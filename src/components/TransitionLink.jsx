"use client";

import { useTransitionRouter } from "next-view-transitions";
import Link from "next/link";
import { usePathname } from "next/navigation";

function pageAnimate() {
  document.documentElement.animate(
    [
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: "translateX(-30px)" },
    ],
    {
      duration: 400,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
      pseudoElement: "::view-transition-old(page-content)",
    }
  );

  document.documentElement.animate(
    [
      { opacity: 0, transform: "translateX(30px)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
    {
      duration: 400,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
      pseudoElement: "::view-transition-new(page-content)",
    }
  );
}

export default function TransitionLink({ children, href, onClick, ...props }) {
  const router = useTransitionRouter();
  const pathname = usePathname();

  const handleClick = (e) => {
    // Call parent onClick if provided
    if (onClick) {
      onClick(e);
    }

    e.preventDefault();
    
    // Don't navigate to same page
    if (href === pathname) {
      return;
    }

    router.push(href, { onTransitionReady: pageAnimate });
  };

  return (
    <Link href={href} {...props} onClick={handleClick}>
      {children}
    </Link>
  );
}