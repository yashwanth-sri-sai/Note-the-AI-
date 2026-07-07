import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoading } from "./LoadingContext";
import { GlobalLoader } from "./GlobalLoader";

interface LoadingOverlayProps {
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ children }) => {
  const { isAppLoading } = useLoading();
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <>
      <AnimatePresence mode="wait">
        {isAppLoading && (
          <motion.div
            key="global-loader"
            initial={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              filter: shouldReduceMotion ? "none" : "blur(8px)",
              transition: { duration: 0.5, ease: "easeInOut" }
            }}
            className="fixed inset-0 z-[9999]"
          >
            <GlobalLoader />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 
        CRITICAL: We keep children mounted in the DOM even while loading
        so that React Query queries inside the dashboard page mount and fetch in parallel.
      */}
      <motion.div
        key="app-content"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 15 }}
        animate={
          isAppLoading 
            ? (shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15, pointerEvents: "none" }) 
            : (shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, pointerEvents: "auto" })
        }
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </>
  );
};
