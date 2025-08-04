import { useEffect, useRef } from 'react';

interface UseSwipeGesturesProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
}

export const useSwipeGestures = ({ 
  onSwipeLeft, 
  onSwipeRight, 
  threshold = 50 
}: UseSwipeGesturesProps) => {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const touchStartTarget = useRef<Element | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
    touchStartY.current = e.changedTouches[0].screenY;
    touchStartTarget.current = e.target as Element;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    touchEndY.current = e.changedTouches[0].screenY;
    handleSwipeGesture();
  };

  const isScrollableElement = (element: Element | null): boolean => {
    if (!element) return false;
    
    // Check if the element or any parent is a scrollable container
    let current = element;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const overflow = style.overflow + style.overflowY + style.overflowX;
      
      // Check for scrollable areas, select dropdowns, and specific UI components
      if (
        overflow.includes('scroll') || 
        overflow.includes('auto') ||
        current.matches('[data-radix-scroll-area-viewport]') ||
        current.matches('[role="listbox"]') ||
        current.matches('[role="menu"]') ||
        current.matches('select') ||
        current.closest('[data-radix-select-content]') ||
        current.closest('[data-radix-dropdown-menu-content]') ||
        current.closest('[data-radix-popover-content]') ||
        current.closest('.scroll-area')
      ) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  const handleSwipeGesture = () => {
    const horizontalDistance = touchStartX.current - touchEndX.current;
    const verticalDistance = Math.abs(touchStartY.current - touchEndY.current);
    
    // If touch started in a scrollable element, be more strict about swipe detection
    if (isScrollableElement(touchStartTarget.current)) {
      // Require larger horizontal movement and minimal vertical movement
      if (verticalDistance > 30 || Math.abs(horizontalDistance) < threshold * 1.5) {
        return; // Likely a scroll gesture, not a swipe
      }
    }
    
    // Standard swipe detection
    if (Math.abs(horizontalDistance) > threshold && verticalDistance < threshold) {
      if (horizontalDistance > 0) {
        // Swipe left (previous)
        onSwipeLeft();
      } else {
        // Swipe right (next)
        onSwipeRight();
      }
    }
  };

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);

  return null;
};