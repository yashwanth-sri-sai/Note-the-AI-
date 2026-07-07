import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

interface QuickActionCardProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: "primary" | "emerald" | "amber" | "rose" | "purple" | "indigo";
}

const colorStyles = {
  primary: {
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    gradient: "from-primary/8",
    glow: "rgba(93,124,255,0.14)",
    stripe: "from-primary",
    hover: "hover:border-primary/35",
  },
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    gradient: "from-emerald-500/8",
    glow: "rgba(16,185,129,0.14)",
    stripe: "from-emerald-500",
    hover: "hover:border-emerald-500/35",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    gradient: "from-amber-500/8",
    glow: "rgba(245,158,11,0.14)",
    stripe: "from-amber-500",
    hover: "hover:border-amber-500/35",
  },
  rose: {
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    gradient: "from-rose-500/8",
    glow: "rgba(244,63,94,0.14)",
    stripe: "from-rose-500",
    hover: "hover:border-rose-500/35",
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    gradient: "from-purple-500/8",
    glow: "rgba(168,85,247,0.14)",
    stripe: "from-purple-500",
    hover: "hover:border-purple-500/35",
  },
  indigo: {
    text: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    gradient: "from-indigo-500/8",
    glow: "rgba(99,102,241,0.14)",
    stripe: "from-indigo-500",
    hover: "hover:border-indigo-500/35",
  },
};

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  label,
  description,
  icon,
  onClick,
  color = "primary",
}) => {
  const shouldReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scheme = colorStyles[color] ?? colorStyles.primary;

  return (
    <motion.div
      whileHover={shouldReduceMotion ? {} : { y: -5, scale: 1.025 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 340, damping: 20 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={label}
      className={`group relative flex flex-col justify-between gap-4 p-5 min-h-[130px] rounded-2xl border border-white/[0.05] bg-gradient-to-br ${scheme.gradient} to-transparent cursor-pointer select-none overflow-hidden transition-colors duration-200 ${scheme.hover} hover:bg-white/[0.03]`}
      style={{ boxShadow: `0 4px 24px ${scheme.glow}` }}
    >
      {/* Top accent stripe */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${scheme.stripe} to-transparent opacity-70`}
      />

      {/* Ambient glow blob */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-25 pointer-events-none group-hover:opacity-40 transition-opacity duration-300"
        style={{ background: scheme.glow }}
      />

      {/* Icon */}
      <span
        className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105 ${scheme.bg} ${scheme.border} ${scheme.text}`}
        aria-hidden="true"
      >
        {React.cloneElement(icon as React.ReactElement, { className: "h-5 w-5" })}
      </span>

      {/* Text */}
      <div className="relative z-10 flex-1 text-left">
        <h4 className={`font-bold text-sm text-foreground/90 group-hover:${scheme.text} transition-colors leading-tight`}>
          {label}
        </h4>
        <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">{description}</p>
      </div>

      {/* Arrow */}
      <ArrowUpRight
        className={`absolute bottom-4 right-4 h-4 w-4 ${scheme.text} opacity-30 group-hover:opacity-90 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200`}
        aria-hidden="true"
      />
    </motion.div>
  );
};
