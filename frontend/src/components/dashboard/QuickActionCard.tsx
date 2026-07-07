import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

interface QuickActionCardProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: "primary" | "emerald" | "amber" | "rose" | "purple";
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  label,
  description,
  icon,
  onClick,
  color = "primary",
}) => {
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const colorStyles = {
    primary: {
      text: "text-primary",
      bg: "bg-primary/8",
      border: "border-primary/15",
      glow: "group-hover:border-primary/40 group-hover:shadow-[0_0_15px_rgba(93,124,255,0.12)]",
    },
    emerald: {
      text: "text-emerald-500",
      bg: "bg-emerald-500/8",
      border: "border-emerald-500/15",
      glow: "group-hover:border-emerald-500/40 group-hover:shadow-[0_0_15px_rgba(67,197,158,0.12)]",
    },
    amber: {
      text: "text-amber-500",
      bg: "bg-amber-500/8",
      border: "border-amber-500/15",
      glow: "group-hover:border-amber-500/40 group-hover:shadow-[0_0_15px_rgba(248,193,78,0.12)]",
    },
    rose: {
      text: "text-rose-500",
      bg: "bg-rose-500/8",
      border: "border-rose-500/15",
      glow: "group-hover:border-rose-500/40 group-hover:shadow-[0_0_15px_rgba(255,107,129,0.12)]",
    },
    purple: {
      text: "text-purple-400",
      bg: "bg-purple-500/8",
      border: "border-purple-500/15",
      glow: "group-hover:border-purple-500/40 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.12)]",
    },
  };

  const scheme = colorStyles[color];

  return (
    <motion.div
      whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.02 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 350, damping: 20 }}
      onClick={onClick}
      className={`group relative p-4 flex items-center justify-between gap-4 cursor-pointer select-none bg-white/[0.015] border border-white/[0.03] rounded-2xl shadow-sm transition-all duration-300 ${scheme.glow}`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-grow text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${scheme.bg} ${scheme.text} ${scheme.border} group-hover:scale-105`}>
          {icon}
        </span>
        <div className="min-w-0">
          <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
            {label}
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug truncate">
            {description}
          </p>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
    </motion.div>
  );
};
