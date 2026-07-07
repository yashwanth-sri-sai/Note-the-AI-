import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export type InsightVariant = "brain" | "book" | "weakness" | "streak" | "quiz" | "general";

interface AIInsightCardProps {
  emoji: string;
  headline: string;
  body: string;
  cta?: string;
  onCta?: () => void;
  variant?: InsightVariant;
  index?: number;
}

const variantStyles: Record<InsightVariant, { from: string; border: string; ctaColor: string; glow: string }> = {
  brain: {
    from: "from-indigo-500/8 via-purple-500/4",
    border: "border-indigo-500/15",
    ctaColor: "text-indigo-400 hover:text-indigo-300",
    glow: "rgba(99,102,241,0.10)",
  },
  book: {
    from: "from-sky-500/8 via-cyan-500/4",
    border: "border-sky-500/15",
    ctaColor: "text-sky-400 hover:text-sky-300",
    glow: "rgba(56,189,248,0.10)",
  },
  weakness: {
    from: "from-rose-500/8 via-pink-500/4",
    border: "border-rose-500/15",
    ctaColor: "text-rose-400 hover:text-rose-300",
    glow: "rgba(244,63,94,0.10)",
  },
  streak: {
    from: "from-amber-500/8 via-orange-500/4",
    border: "border-amber-500/15",
    ctaColor: "text-amber-400 hover:text-amber-300",
    glow: "rgba(245,158,11,0.10)",
  },
  quiz: {
    from: "from-emerald-500/8 via-teal-500/4",
    border: "border-emerald-500/15",
    ctaColor: "text-emerald-400 hover:text-emerald-300",
    glow: "rgba(16,185,129,0.10)",
  },
  general: {
    from: "from-purple-500/8 via-violet-500/4",
    border: "border-purple-500/15",
    ctaColor: "text-purple-400 hover:text-purple-300",
    glow: "rgba(168,85,247,0.10)",
  },
};

const sparkleVariants = {
  idle: { scale: 1, rotate: 0 },
  sparkle: {
    scale: [1, 1.15, 0.95, 1.08, 1],
    rotate: [0, 8, -6, 4, 0],
    transition: { duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 },
  },
};

export const AIInsightCard: React.FC<AIInsightCardProps> = ({
  emoji,
  headline,
  body,
  cta,
  onCta,
  variant = "general",
  index = 0,
}) => {
  const shouldReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const styles = variantStyles[variant] ?? variantStyles.general;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.08,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={shouldReduceMotion ? {} : { y: -2, scale: 1.008 }}
      className={`relative p-5 rounded-2xl border bg-gradient-to-br ${styles.from} to-transparent ${styles.border} overflow-hidden group`}
      style={{ boxShadow: `0 4px 20px ${styles.glow}` }}
    >
      {/* Soft glow blob */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-30 blur-2xl pointer-events-none"
        style={{ background: styles.glow }}
      />

      <div className="relative z-10 flex items-start gap-3.5">
        {/* Emoji sparkle */}
        <motion.span
          variants={shouldReduceMotion ? {} : sparkleVariants}
          initial="idle"
          animate={shouldReduceMotion ? "idle" : "sparkle"}
          className="text-xl shrink-0 select-none leading-none mt-0.5"
          aria-hidden="true"
        >
          {emoji}
        </motion.span>

        {/* Text content */}
        <div className="flex-1 min-w-0 space-y-1.5 text-left">
          <h4 className="text-[11.5px] font-bold text-foreground/90 leading-snug">
            {headline}
          </h4>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            {body}
          </p>
          {cta && onCta && (
            <button
              onClick={onCta}
              className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold transition-colors ${styles.ctaColor} group/btn`}
              aria-label={cta}
            >
              {cta}
              <ArrowRight className="h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
