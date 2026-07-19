import React from "react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";

interface KnowledgeCardProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  description: string;
  color: "sky" | "emerald" | "amber" | "rose" | "purple" | "indigo" | "cyan";
  onClick?: () => void;
  index?: number;
}

const colorMap = {
  sky: {
    text: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    glow: "rgba(56,189,248,0.12)",
    gradient: "from-sky-500/6",
    ring: "ring-sky-500/20",
  },
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "rgba(16,185,129,0.12)",
    gradient: "from-emerald-500/6",
    ring: "ring-emerald-500/20",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "rgba(245,158,11,0.12)",
    gradient: "from-amber-500/6",
    ring: "ring-amber-500/20",
  },
  rose: {
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    glow: "rgba(244,63,94,0.12)",
    gradient: "from-rose-500/6",
    ring: "ring-rose-500/20",
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    glow: "rgba(168,85,247,0.12)",
    gradient: "from-purple-500/6",
    ring: "ring-purple-500/20",
  },
  indigo: {
    text: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    glow: "rgba(99,102,241,0.12)",
    gradient: "from-indigo-500/6",
    ring: "ring-indigo-500/20",
  },
  cyan: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    glow: "rgba(6,182,212,0.12)",
    gradient: "from-cyan-500/6",
    ring: "ring-cyan-500/20",
  },
};

export const KnowledgeCard: React.FC<KnowledgeCardProps> = ({
  icon,
  label,
  count,
  description,
  color,
  onClick,
  index = 0,
}) => {
  const shouldReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scheme = colorMap[color] ?? colorMap.indigo;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.055,
        duration: 0.38,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.02 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      aria-label={onClick ? `View ${label}` : undefined}
      className={`relative flex flex-col gap-3 p-5 rounded-lg clay-card overflow-hidden ${onClick ? "cursor-pointer select-none" : ""}`}
    >
      {/* Ambient glow */}
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-40 pointer-events-none"
        style={{ background: scheme.glow }}
      />

      {/* Icon */}
      <div className="relative z-10 flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${scheme.bg} ${scheme.border} ${scheme.text}`}
          aria-hidden="true"
        >
          {icon}
        </span>

        {count > 0 && (
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${scheme.bg} ${scheme.text} border ${scheme.border}`}>
            Active
          </span>
        )}
      </div>

      {/* Count */}
      <div className="relative z-10">
        <h3 className={`text-3xl font-black ${scheme.text} leading-none`}>
          <AnimatedCounter value={count} />
        </h3>
      </div>

      {/* Label + description */}
      <div className="relative z-10 text-left">
        <p className="text-[11px] font-bold text-foreground/80">{label}</p>
        <p className="text-[9.5px] text-muted-foreground/55 mt-0.5 leading-snug">{description}</p>
      </div>
    </motion.div>
  );
};
