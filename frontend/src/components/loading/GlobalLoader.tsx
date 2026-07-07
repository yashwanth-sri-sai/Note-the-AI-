import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { AnimatedLogo } from "./AnimatedLogo";
import { ProgressLine } from "./ProgressLine";
import { LoadingMessage } from "./LoadingMessage";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export const GlobalLoader: React.FC = () => {
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Generate deterministic particles to avoid hydration mismatches
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: (i * 7) % 100, // percentage spacing
      y: (i * 13) % 100,
      size: (i % 3) + 2, // 2px to 4px
      duration: 6 + (i % 5) * 1.5, // 6s to 12s
      delay: (i % 4) * 0.5,
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B0C10] select-none overflow-hidden">
      {/* Background Interactive Particles */}
      {!shouldReduceMotion && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              style={{
                position: "absolute",
                left: `${p.x}%`,
                bottom: `-10%`,
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(93,124,255,0.4) 0%, rgba(93,124,255,0) 70%)",
                boxShadow: "0 0 8px rgba(93,124,255,0.15)",
              }}
              animate={{
                y: ["0vh", "-120vh"],
                x: [`0vw`, `${(p.id % 2 === 0 ? 1 : -1) * 3}vw`, `0vw`],
                opacity: [0, 0.4, 0.4, 0],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: p.delay,
              }}
            />
          ))}
        </div>
      )}

      {/* Glassmorphic Loader Inner Frame */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center justify-center p-12 rounded-3xl bg-white/[0.015] border border-white/[0.03] backdrop-blur-md shadow-[0_24px_80px_rgba(0,0,0,0.45)] max-w-sm w-full gap-8 mx-4"
      >
        {/* Glowing aura edge */}
        {!shouldReduceMotion && (
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        )}

        <AnimatedLogo />

        <div className="flex flex-col items-center justify-center gap-3">
          <ProgressLine />
          <LoadingMessage />
        </div>
      </motion.div>
    </div>
  );
};
