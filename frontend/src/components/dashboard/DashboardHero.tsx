import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Terminal } from "lucide-react";

interface DashboardHeroProps {
  userName?: string;
  workspaceName?: string;
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  userName = "Researcher",
  workspaceName = "Global Space",
}) => {
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Compute greeting dynamically based on the current hour of local time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: "Good Morning", emoji: "👋" };
    if (hour >= 12 && hour < 17) return { text: "Good Afternoon", emoji: "☀️" };
    return { text: "Good Evening", emoji: "🌌" };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 140,
        damping: 18,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={shouldReduceMotion ? {} : containerVariants}
      initial="hidden"
      animate="show"
      className="relative p-7 rounded-3xl bg-gradient-to-br from-primary/8 via-indigo-500/3 to-transparent border border-primary/10 overflow-hidden text-left"
    >
      {/* Background neon soft blur dots */}
      {!shouldReduceMotion && (
        <>
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-[80px] pointer-events-none -mr-24 -mt-24" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-violet/5 rounded-full blur-[70px] pointer-events-none -ml-20 -mb-20" />
        </>
      )}

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          {/* Active workspace node tag */}
          <motion.div
            variants={shouldReduceMotion ? {} : itemVariants}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/15 text-primary shadow-sm"
          >
            <Terminal className="h-3 w-3" />
            Workspace: {workspaceName}
          </motion.div>

          <motion.h1
            variants={shouldReduceMotion ? {} : itemVariants}
            className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent"
          >
            {greeting.text}, {userName} {greeting.emoji}
          </motion.h1>
          
          <motion.p
            variants={shouldReduceMotion ? {} : itemVariants}
            className="text-xs text-muted-foreground/80 leading-relaxed max-w-xl"
          >
            Ready to expand your knowledge today? Everything you write or index becomes a unified part of your second brain context.
          </motion.p>
        </div>

        <motion.div
          variants={shouldReduceMotion ? {} : itemVariants}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-[0_0_15px_rgba(93,124,255,0.15)] animate-pulse"
        >
          <Sparkles className="h-5 w-5" />
        </motion.div>
      </div>
    </motion.div>
  );
};
