import React from "react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";

interface DashboardMetricProps {
  title: string;
  value: number;
  suffix?: string;
  growth?: string;
  icon: React.ReactNode;
  color?: "sky" | "indigo" | "amber" | "rose" | "emerald" | "purple" | "cyan";
  onClick?: () => void;
}

const colorMap = {
  sky: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
    stripe: "from-sky-500",
    glow: "rgba(56,189,248,0.10)",
  },
  indigo: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
    stripe: "from-indigo-500",
    glow: "rgba(99,102,241,0.10)",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    stripe: "from-amber-500",
    glow: "rgba(245,158,11,0.10)",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    stripe: "from-rose-500",
    glow: "rgba(244,63,94,0.10)",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    stripe: "from-emerald-500",
    glow: "rgba(16,185,129,0.10)",
  },
  purple: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
    stripe: "from-purple-500",
    glow: "rgba(168,85,247,0.10)",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
    stripe: "from-cyan-500",
    glow: "rgba(6,182,212,0.10)",
  },
};

export const DashboardMetric: React.FC<DashboardMetricProps> = ({
  title,
  value,
  suffix,
  growth,
  icon,
  color = "indigo",
  onClick,
}) => {
  const shouldReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scheme = colorMap[color] ?? colorMap.indigo;

  return (
    <motion.div
      whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.025 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 350, damping: 22 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      aria-label={onClick ? `View ${title}` : undefined}
      className={`relative flex flex-col justify-between p-6 rounded-lg clay-card overflow-hidden ${onClick ? "cursor-pointer select-none" : ""}`}
      style={{ borderLeftWidth: "4px", borderLeftColor: `hsl(var(--${color === "indigo" ? "primary" : color === "sky" ? "cyan" : color}))` }}
    >
      {/* Top gradient stripe — 2px color accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${scheme.stripe} to-transparent opacity-80`}
      />

      {/* Ambient glow */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-30 pointer-events-none"
        style={{ background: scheme.glow }}
      />

      {/* Icon + Title row */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <p className="text-[9.5px] uppercase font-extrabold tracking-wider text-muted-foreground/55 leading-tight mt-0.5">
          {title}
        </p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${scheme.bg} ${scheme.border} ${scheme.text}`}
          aria-hidden="true"
        >
          {React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4" })}
        </span>
      </div>

      {/* Value */}
      <div className="relative z-10 mt-3">
        <h3 className={`text-2xl font-black ${scheme.text} leading-none`}>
          <AnimatedCounter value={value} />
          {suffix && <span className="text-base font-bold ml-0.5 opacity-80">{suffix}</span>}
        </h3>
      </div>

      {/* Growth badge */}
      {growth && (
        <div className="relative z-10 mt-2.5 pt-2.5 border-t border-white/[0.04]">
          <span className={`text-[9px] font-bold ${scheme.text} opacity-80`}>{growth}</span>
        </div>
      )}
    </motion.div>
  );
};
