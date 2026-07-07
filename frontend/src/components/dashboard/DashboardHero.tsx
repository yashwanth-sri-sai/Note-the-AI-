import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Brain, ArrowRight } from "lucide-react";

interface DashboardHeroProps {
  userName?: string;
  workspaceName?: string;
  onResume?: () => void;
}

const PARTICLE_POSITIONS = [
  { top: "18%", left: "12%", size: 3, delay: 0 },
  { top: "65%", left: "7%", size: 2, delay: 0.8 },
  { top: "40%", left: "88%", size: 2.5, delay: 0.4 },
  { top: "75%", left: "82%", size: 2, delay: 1.2 },
  { top: "25%", left: "55%", size: 1.5, delay: 0.6 },
  { top: "85%", left: "45%", size: 2, delay: 1.0 },
];

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  userName = "Learner",
  workspaceName = "Global Space",
  onResume,
}) => {
  const shouldReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: "Good Morning", emoji: "👋", sub: "Start your day with focused study." };
    if (hour >= 12 && hour < 17) return { text: "Good Afternoon", emoji: "☀️", sub: "Keep the momentum going." };
    return { text: "Good Evening", emoji: "🌌", sub: "Evening sessions build the deepest memory." };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 22 } },
  };

  return (
    <motion.div
      variants={shouldReduceMotion ? {} : containerVariants}
      initial="hidden"
      animate="show"
      className="relative rounded-3xl overflow-hidden border border-white/[0.06] text-left"
      style={{
        background:
          "linear-gradient(135deg, rgba(93,124,255,0.12) 0%, rgba(99,102,241,0.06) 35%, rgba(139,92,246,0.05) 65%, rgba(6,182,212,0.04) 100%)",
        boxShadow: "0 8px 40px rgba(93,124,255,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Aurora gradient orbs */}
      {!shouldReduceMotion && (
        <>
          <div
            className="absolute top-0 right-0 w-[380px] h-[380px] rounded-full blur-[100px] pointer-events-none opacity-60"
            style={{ background: "radial-gradient(circle, rgba(93,124,255,0.18) 0%, transparent 70%)", transform: "translate(30%, -30%)" }}
          />
          <div
            className="absolute bottom-0 left-0 w-[280px] h-[280px] rounded-full blur-[80px] pointer-events-none opacity-50"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)", transform: "translate(-25%, 25%)" }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-[200px] h-[200px] rounded-full blur-[60px] pointer-events-none opacity-30"
            style={{ background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)", transform: "translate(-50%, -50%)" }}
          />
        </>
      )}

      {/* Floating particles */}
      {!shouldReduceMotion &&
        PARTICLE_POSITIONS.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-primary/40 pointer-events-none"
            style={{ top: p.top, left: p.left, width: p.size, height: p.size }}
            animate={{
              y: [-4, 4, -4],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 3.5 + i * 0.5,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

      {/* Glass inner layer */}
      <div
        className="relative z-10 p-7 md:p-9"
        style={{ backdropFilter: "blur(1px)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Greeting */}
          <div className="space-y-3">
            {/* Workspace badge */}
            <motion.div
              variants={shouldReduceMotion ? {} : itemVariants}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9.5px] font-bold uppercase tracking-widest bg-primary/10 border border-primary/20 text-primary"
            >
              <Brain className="h-3 w-3" aria-hidden="true" />
              {workspaceName}
            </motion.div>

            {/* Main greeting */}
            <motion.h1
              variants={shouldReduceMotion ? {} : itemVariants}
              className="text-2xl md:text-[2rem] font-black tracking-tight leading-tight"
              style={{
                background: "linear-gradient(120deg, hsl(var(--foreground)) 0%, hsl(var(--foreground)) 55%, var(--primary) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {greeting.text}, {userName} {greeting.emoji}
            </motion.h1>

            {/* Tagline */}
            <motion.p
              variants={shouldReduceMotion ? {} : itemVariants}
              className="text-sm text-muted-foreground/70 leading-relaxed max-w-lg"
            >
              Ready to continue your learning journey?{" "}
              <span className="text-muted-foreground/50">{greeting.sub}</span>
            </motion.p>

            {/* CTA Button */}
            <motion.div variants={shouldReduceMotion ? {} : itemVariants}>
              <motion.button
                whileHover={shouldReduceMotion ? {} : { scale: 1.03, y: -1 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                onClick={onResume}
                aria-label="Resume Learning"
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white border border-primary/30 transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, var(--primary) 0%, hsl(250,80%,55%) 100%)",
                  boxShadow: "0 4px 16px rgba(93,124,255,0.30)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Resume Learning
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </motion.button>
            </motion.div>
          </div>

          {/* Right: AI Orb iconography */}
          <motion.div
            variants={shouldReduceMotion ? {} : itemVariants}
            className="shrink-0 self-center"
          >
            <motion.div
              animate={shouldReduceMotion ? {} : {
                boxShadow: [
                  "0 0 20px rgba(93,124,255,0.2)",
                  "0 0 40px rgba(93,124,255,0.35)",
                  "0 0 20px rgba(93,124,255,0.2)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-3xl border border-primary/20"
              style={{
                background: "linear-gradient(135deg, rgba(93,124,255,0.15) 0%, rgba(139,92,246,0.10) 100%)",
                backdropFilter: "blur(8px)",
              }}
            >
              <Brain className="h-9 w-9 md:h-11 md:w-11 text-primary" aria-hidden="true" />
              {/* Pulsing ring */}
              {!shouldReduceMotion && (
                <motion.div
                  className="absolute inset-0 rounded-3xl border border-primary/30"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
