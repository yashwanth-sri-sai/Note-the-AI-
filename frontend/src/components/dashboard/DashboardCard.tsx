import React from "react";
import { motion } from "framer-motion";

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  children,
  className = "",
  onClick,
  hoverEffect = true,
}) => {
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cardProps = hoverEffect && !shouldReduceMotion
    ? {
        whileHover: { scale: 1.015, y: -3 },
        whileTap: { scale: 0.995 },
        transition: { type: "spring", stiffness: 350, damping: 22 },
      }
    : {};

  return (
    <motion.div
      {...cardProps}
      onClick={onClick}
      className={`clay-card p-5 relative overflow-hidden bg-white/[0.015] border border-white/[0.03] shadow-md rounded-2xl ${
        onClick ? "cursor-pointer select-none" : ""
      } ${className}`}
    >
      {/* Subtle top reflection accent */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      {children}
    </motion.div>
  );
};
