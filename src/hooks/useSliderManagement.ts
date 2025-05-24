// src/hooks/useSliderManagement.ts
import { useState, useCallback } from "react";
import { SLIDER_TYPES, INITIAL_ORDER } from "@/lib/constants";

// Define initial visibility based on INITIAL_ORDER
const initialVisibility = INITIAL_ORDER.reduce((acc, sliderId) => {
  acc[sliderId] = !(
    sliderId === SLIDER_TYPES.PROJECT || sliderId === SLIDER_TYPES.DOCUMENT
  );
  return acc;
}, {} as Record<string, boolean>);

export function useSliderManagement() {
  const [sliderOrder, setSliderOrder] = useState<string[]>(INITIAL_ORDER);
  const [visibility, setVisibility] =
    useState<Record<string, boolean>>(initialVisibility);

  const toggleVisibility = useCallback((sliderId: string) => {
    // Ensure sliderId is a valid key in SLIDER_TYPES or INITIAL_ORDER before toggling
    if (
      !Object.values(SLIDER_TYPES).includes(sliderId as any) &&
      !INITIAL_ORDER.includes(sliderId)
    ) {
      console.warn(`toggleVisibility: Invalid sliderId: ${sliderId}`);
      return;
    }
    setVisibility((prev) => ({ ...prev, [sliderId]: !prev[sliderId] }));
  }, []);

  const moveSlider = useCallback(
    (sliderId: string, direction: "up" | "down") => {
      setSliderOrder((currentOrder) => {
        const currentIndex = currentOrder.indexOf(sliderId);
        // Ensure slider is actually part of the order and visible before trying to move
        if (currentIndex === -1 || !visibility[sliderId]) return currentOrder;

        let targetIndex = -1;
        if (direction === "up") {
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (visibility[currentOrder[i]]) {
              // Check if the target is visible
              targetIndex = i;
              break;
            }
          }
        } else {
          // direction === "down"
          for (let i = currentIndex + 1; i < currentOrder.length; i++) {
            if (visibility[currentOrder[i]]) {
              // Check if the target is visible
              targetIndex = i;
              break;
            }
          }
        }

        if (targetIndex === -1) return currentOrder; // No valid visible move target

        const newOrder = [...currentOrder];
        [newOrder[currentIndex], newOrder[targetIndex]] = [
          newOrder[targetIndex],
          newOrder[currentIndex],
        ];
        return newOrder;
      });
    },
    [visibility]
  ); // Depends on current visibility

  return {
    sliderOrder,
    // setSliderOrder, // Not exposing setSliderOrder directly, use moveSlider
    visibility,
    toggleVisibility,
    moveSlider,
  };
}
