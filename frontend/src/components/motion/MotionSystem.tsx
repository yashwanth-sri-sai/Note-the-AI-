import React from "react";
import { motion, AnimatePresence, useReducedMotion, Variants } from "framer-motion";

// 1. Easing Curve Presets
export const EASE_AURORA = [0.16, 1, 0.3, 1]; // Premium, Apple-like ease-out
export const EASE_PAGE = "easeInOut";

// 2. Motion Presets Definition
export const presets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fadeUp: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
  },
  fadeDown: {
    initial: { opacity: 0, y: -16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
  },
  tooltipFade: {
    initial: { opacity: 0, scale: 0.95, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 4 },
  }
};

// 3. MotionWrapper Component
interface MotionWrapperProps {
  children: React.ReactNode;
  preset?: keyof typeof presets;
  className?: string;
  delay?: number;
}

export const MotionWrapper: React.FC<MotionWrapperProps> = ({
  children,
  preset = "fadeIn",
  className = "",
  delay = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const selectedPreset = presets[preset];

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={selectedPreset.initial}
      animate={selectedPreset.animate}
      exit={selectedPreset.exit}
      transition={{ duration: 0.3, ease: EASE_AURORA, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// 4. PageTransition Component
interface PageTransitionProps {
  children: React.ReactNode;
  pageKey?: string;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  pageKey,
  className = "w-full h-full",
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={pageKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        enter: { duration: 0.30, ease: EASE_PAGE },
        exit: { duration: 0.18, ease: EASE_PAGE },
        duration: 0.30,
        ease: EASE_PAGE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// 5. AnimatedCard Component
interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  index?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = "",
  onClick,
  index = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 24,
        delay: index * 0.04, // 40ms stagger
      },
    },
  };

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : cardVariants}
      initial={shouldReduceMotion ? undefined : "hidden"}
      animate={shouldReduceMotion ? undefined : "visible"}
      whileHover={
        shouldReduceMotion || !onClick
          ? undefined
          : { y: -2, scale: 1.01, transition: { duration: 0.2, ease: EASE_AURORA } }
      }
      whileTap={shouldReduceMotion || !onClick ? undefined : { scale: 0.98 }}
      onClick={onClick}
      className={`${className} ${onClick ? "cursor-pointer" : ""}`}
    >
      {children}
    </motion.div>
  );
};

// 6. AnimatedList Component
interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();

  const listVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={listVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
};

// 7. AnimatedModal Component
interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[6px]"
          />

          {/* Modal Container */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 8, filter: "blur(8px)" }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 8, filter: "blur(8px)" }
            }
            transition={{ duration: 0.28, ease: EASE_AURORA }}
            className={`relative z-10 w-full max-w-lg glass-panel p-6 overflow-hidden ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 8. AnimatedDrawer Component
interface AnimatedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  side?: "left" | "right";
}

export const AnimatedDrawer: React.FC<AnimatedDrawerProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  side = "right",
}) => {
  const shouldReduceMotion = useReducedMotion();
  const directionMultiplier = side === "right" ? 1 : -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-55 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-[3px]"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 20 * directionMultiplier }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 20 * directionMultiplier }
            }
            transition={{ duration: 0.25, ease: EASE_AURORA }}
            className={`fixed top-0 bottom-0 ${
              side === "right" ? "right-0" : "left-0"
            } z-50 w-full max-w-md bg-[#101A2C] border-l border-white/[0.03] shadow-2xl flex flex-col justify-between ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 9. AnimatedSection Component
interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  className = "",
  delay = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_AURORA, delay }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

// 10. AnimatedHero Component (Cascading Staggered Grid)
interface AnimatedHeroProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedHero: React.FC<AnimatedHeroProps> = ({
  children,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08, // Stagger elements by 80ms
      },
    },
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
};
