import React from "react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";

interface DashboardMetricProps {
  title: string;
  value: number;
  growth?: string;
  icon: React.ReactNode;
  color?: "sky" | "indigo" | "amber" | "rose" | "emerald" | "purple" | "cyan";
  onClick?: () => void;
}

export const DashboardMetric: React.FC<DashboardMetricProps> = ({
  title,
  value,
  growth,
  icon,
  color = "indigo",
  onClick,
}) => {
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Resolve tailwind background classes based on theme colors
  const colorMap = {
    sky: {
      bg: "bg-sky-500/10",
      text: "text-sky-600 dark:text-sky-400",
      border: "border-sky-500/20",
      glow: "rgba(56,189,248,0.12)",
    },
    indigo: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-500/20",
      glow: "rgba(99,102,241,0.12)",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/20",
      glow: "rgba(245,158,11,0.12)",
    },
    rose: {
      bg: "bg-rose-500/10",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-500/20",
      glow: "rgba(244,63,94,0.12)",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20",
      glow: "rgba(16,185,129,0.12)",
    },
    purple: {
      bg: "bg-purple-500/10",
      text: "text-purple-600 dark:text-purple-400",
      border: "border-purple-500/20",
      glow: "rgba(168,85,247,0.12)",
    },
    cyan: {
      bg: "bg-cyan-500/10",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-500/20",
      glow: "rgba(6,182,212,0.12)",
    },
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      whileHover={shouldReduceMotion ? {} : { scale: 1.025, y: -4 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.99 }}
      transition={{ type: "spring", stiffness: 350, damping: 22 }}
      onClick={onClick}
      style={{
        boxShadow: `0 4px 20px 0 rgba(0, 0, 0, 0.15)`,
      }}
      className={`clay-card p-5 relative overflow-hidden bg-white/[0.015] border border-white/[0.03] rounded-2xl flex flex-col justify-between h-32 text-left transition-all ${
        onClick ? "cursor-pointer select-none" : ""
      }`}
    >
      {/* Light spotlight reflection when hovered */}
      {!shouldReduceMotion && (
        <div 
          style={{ background: `radial-gradient(circle at 10% 10%, ${scheme.glow} 0%, transparent 70%)` }}
          className="absolute inset-0 z-0 pointer-events-none" 
        />
      )}

      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[9.5px] uppercase font-extrabold tracking-wider text-muted-foreground/60">
            {title}
          </p>
          <h3 className="text-2xl font-black text-foreground">
            <AnimatedCounter value={value} />
          </h3>
        </div>

        <span className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-inner ${scheme.bg} ${scheme.text} ${scheme.border} border`}>
          {icon}
        </span>
      </div>

      {growth && (
        <div className="relative z-10 pt-2 border-t border-white/[0.02] flex items-center justify-between">
          <span className="text-[8.5px] font-bold text-muted-foreground/40 leading-none">Status Summary</span>
          <span className={`text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/[0.03] ${scheme.text}`}>
            {growth}
          </span>
        </div>
      )}
    </motion.div>
  );
};
