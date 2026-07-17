import React from "react";
import { motion } from "framer-motion";
import { Logo } from "../common/Logo";

export const AnimatedLogo: React.FC = () => {
  // Respect user preference for reduced motion
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const glowVariants = {
    initial: { opacity: 0.15, scale: 0.8 },
    animate: {
      opacity: [0.15, 0.35, 0.15],
      scale: [0.9, 1.15, 0.9],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  const auraVariants = {
    initial: { rotate: 0 },
    animate: {
      rotate: 360,
      transition: {
        duration: 8,
        repeat: Infinity,
        ease: "linear",
      },
    },
  };

  const iconContainerVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 15,
      },
    },
  };

  const letterVariants = {
    initial: { y: 8, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 150,
        damping: 12,
      },
    },
  };

  return (
    <motion.div
      variants={shouldReduceMotion ? {} : containerVariants}
      initial="initial"
      animate="animate"
      className="relative flex flex-col items-center justify-center gap-4 select-none"
    >
      {/* Cinematic Glowing Background Aura */}
      {!shouldReduceMotion && (
        <>
          <motion.div
            variants={glowVariants}
            className="absolute h-36 w-36 rounded-full bg-primary/20 blur-[50px] z-0 pointer-events-none"
          />
          <motion.div
            variants={auraVariants}
            className="absolute h-24 w-24 rounded-full border border-primary/10 border-dashed z-0 pointer-events-none"
          />
        </>
      )}

      {/* Main Logo Icon Container */}
      <motion.div
        variants={shouldReduceMotion ? {} : iconContainerVariants}
        className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-indigo-500/5 to-transparent border border-primary/20 shadow-[0_0_30px_rgba(93,124,255,0.08)]"
      >
        <Logo size={44} animateOrbit={!shouldReduceMotion} />
      </motion.div>

      {/* Logo Text "NoteAI" with Premium Staggered Typography */}
      <div className="flex items-center gap-0.5 z-10">
        {"NoteAI".split("").map((char, index) => (
          <motion.span
            key={index}
            variants={shouldReduceMotion ? {} : letterVariants}
            className={`text-xl font-black tracking-tight ${
              index >= 4
                ? "text-primary"
                : "text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text"
            }`}
          >
            {char}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
};
