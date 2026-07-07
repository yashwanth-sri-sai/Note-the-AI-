import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MESSAGES = [
  "Initializing Workspace...",
  "Authenticating...",
  "Loading Knowledge Base...",
  "Connecting AI...",
  "Preparing Workspace...",
  "Launching NoteAI...",
];

export const LoadingMessage: React.FC = () => {
  const [index, setIndex] = useState(0);
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 700);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-4 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="text-[10px] font-mono tracking-wider text-muted-foreground/60 select-none uppercase font-semibold"
        >
          {MESSAGES[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
