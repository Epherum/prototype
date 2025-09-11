# ERP View Transitions Implementation Guide

## Current State Analysis

### ❌ Incorrect Implementation in ERP

The ERP project currently has an **incorrect** implementation of Next.js View Transitions that will not work properly.

#### Issues Found:

1. **Wrong ViewTransitions Wrapper Position** (`src/app/layout.js:26-28`):
```jsx
// ❌ INCORRECT - ViewTransitions wrapping only children, not entire app
<Providers>
  <Header />
  <ViewTransitions>
    {children}  // Only page content, missing root structure
  </ViewTransitions>
</Providers>
```

2. **Incomplete CSS Implementation** (`src/styles/globals.css:20-57`):
   - Has basic CSS rules but **missing JavaScript animation logic**
   - No actual transition router usage in components
   - No custom animation functions
   - View transition styles exist but are not connected to any transition system

3. **Missing Core Components**:
   - No `TransitionLink` or `InteractiveLink` components
   - No usage of `useTransitionRouter` anywhere in the codebase
   - Navigation still uses standard Next.js `Link` components

4. **Wrong Version/Setup**:
   - Uses `next-view-transitions` v0.3.4 (same as Nexel) but implemented incorrectly
   - CSS animations are defined but never triggered by actual view transitions

## ✅ Correct Implementation (Based on Nexel)

### 1. Fix Root Layout (`src/app/layout.js`)
```jsx
// ✅ CORRECT - ViewTransitions must wrap the entire app structure
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <ViewTransitions>  {/* Must be at top level */}
        <body>
          <Providers>
            <Header />
            {children}
          </Providers>
        </body>
      </ViewTransitions>
    </html>
  );
}
```

### 2. Create TransitionLink Component
```jsx
// src/components/TransitionLink.jsx
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

export default function TransitionLink({ children, href, ...props }) {
  const router = useTransitionRouter();
  const pathname = usePathname();

  const handleClick = (e) => {
    e.preventDefault();
    if (href === pathname) return;
    router.push(href, { onTransitionReady: pageAnimate });
  };

  return (
    <Link href={href} {...props} onClick={handleClick}>
      {children}
    </Link>
  );
}
```

### 3. Update CSS (`src/styles/globals.css`)
```css
/* ✅ Correct CSS - matches ERP's existing but adds missing pieces */

/* Page content transitions */
::view-transition-old(page-content) {
  animation: fade-slide-out 0.4s ease-out forwards;
}

::view-transition-new(page-content) {
  animation: fade-slide-in 0.4s ease-in forwards;
}

/* Disable root transitions to use page-content instead */
::view-transition-old(root) {
  animation: none;
}

::view-transition-new(root) {
  animation: none;
}

/* Header should not transition */
::view-transition-old(main-header),
::view-transition-new(main-header) {
  animation: none;
}

@keyframes fade-slide-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-30px);
  }
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Enable view transitions */
@view-transition {
  navigation: auto;
}
```

### 4. Update Navigation Components
Replace all navigation `Link` imports with `TransitionLink`:

```jsx
// ❌ BEFORE
import Link from "next/link";

// ✅ AFTER  
import TransitionLink from "@/components/TransitionLink";

// Update usage
<TransitionLink href="/path">Navigate</TransitionLink>
```

### 5. Add view-transition-name to Main Content
```jsx
// In page components or main layout
<main style={{ viewTransitionName: 'page-content' }}>
  {/* Page content */}
</main>
```

## Key Differences: Nexel vs ERP

| Aspect | Nexel (✅ Correct) | ERP (❌ Incorrect) |
|--------|-------------------|-------------------|
| **ViewTransitions Position** | Wraps entire app at html level | Only wraps children content |
| **Animation Logic** | JavaScript-driven with Web Animations API | CSS-only, no trigger mechanism |
| **Router Usage** | Uses `useTransitionRouter` in components | No router usage found |
| **Link Components** | Custom `TransitionLink` and `InteractiveLink` | Standard Next.js Link only |
| **CSS Implementation** | Disables default animations, custom logic | Has styles but incomplete |
| **Transition Names** | Uses `root` and custom names | Uses `page-content` but not connected |

## Implementation Action Plan for ERP

### Step 1: Fix Layout Structure
- Move `ViewTransitions` to wrap entire app in `layout.js`

### Step 2: Create Transition Components  
- Create `TransitionLink` component with proper animation logic
- Create `InteractiveLink` if cursor interactions needed

### Step 3: Update Navigation
- Replace all `Link` usage with `TransitionLink`
- Update header navigation components
- Update slider navigation if applicable

### Step 4: Test and Refine
- Test transitions between different pages
- Adjust animation timing/easing if needed
- Ensure no conflicts with existing Framer Motion animations

### Step 5: Advanced Features (Optional)
- Add view-transition-name to specific elements for granular control
- Implement page-specific transition animations
- Add loading states during transitions

## Browser Compatibility Notes

- View Transitions API is supported in modern Chromium browsers
- Falls back gracefully in unsupported browsers
- No additional polyfills needed with `next-view-transitions`

## Performance Considerations

- Animations run at 60fps using browser's optimized animation engine
- No JavaScript execution during animation
- Minimal impact on Core Web Vitals
- Consider `will-change` property for complex transitions

## Troubleshooting Common Issues

1. **Transitions not working**: Check ViewTransitions wrapper position
2. **Animations not smooth**: Verify CSS keyframes and JavaScript animation logic
3. **Header transitioning**: Add `view-transition-name: main-header` to header
4. **Conflicting animations**: Ensure proper z-index and animation timing

## Dependencies Required

```json
{
  "next-view-transitions": "^0.3.4"
}
```

**Next Steps for Future AI:**
1. Implement the layout fix first (highest priority)
2. Create and test TransitionLink component
3. Systematically replace Link usage across the application
4. Test thoroughly across different page types in the ERP system