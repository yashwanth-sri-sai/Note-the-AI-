import React, { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

interface ProgressLineProps {
  progress?: number; // Optional manual control (0 to 100)
}

export const ProgressLine: React.FC<ProgressLineProps> = ({ progress: manualProgress }) => {
  const [autoProgress, setAutoProgress] = useState(0);
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const springValue = useSpring(0, {
    stiffness: 80,
    damping: 18,
    restDelta: 0.01,
  });

  // Target progress value is either manual or simulated auto progress
  const targetProgress = manualProgress !== undefined ? manualProgress : autoProgress;

  useEffect(() => {
    // If not manual progress, simulate organic launch boot loading sequence
    if (manualProgress === undefined) {
      const intervals = [
        { time: 100, val: 15 },
        { time: 400, val: 35 },
        { time: 800, val: 55 },
        { time: 1500, val: 78 },
        { time: 2400, val: 89 },
        { time: 3500, val: 94 },
      ];

      const timers = intervals.map((item) => 
        setTimeout(() => {
          setAutoProgress(item.val);
        }, item.time)
      );

      return () => {
        timers.forEach((t) => clearTimeout(t));
      };
    }
  }, [manualProgress]);

  useEffect(() => {
    springValue.set(targetProgress);
  }, [targetProgress, springValue]);

  return (
    <div className="w-36 h-[2.5px] rounded-full bg-white/[0.03] border border-white/[0.01] overflow-hidden relative shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
      <motion.div
        style={{ width: shouldReduceMotion ? `${targetProgress}%` : springValue }}
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-primary to-primary shadow-[0_0_10px_rgba(93,124,255,0.4)]"
      />
    </div>
  );
};
