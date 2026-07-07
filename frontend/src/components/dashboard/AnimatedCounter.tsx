import React, { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Animate from 0 to target value
    const controls = animate(count, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1], // premium easeOutQuart curve
    });
    
    // Direct DOM text mutation for raw performance and framework-level compatibility
    const unsubscribe = rounded.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = latest.toString();
      }
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, count, rounded]);

  return <span ref={ref}>0</span>;
};
