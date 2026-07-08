import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BrainCircuit, Sparkles } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { EASE_AURORA } from "@/components/motion/MotionSystem";

interface WorkspacePanelToggleProps {
  className?: string;
}

export const WorkspacePanelToggle: React.FC<WorkspacePanelToggleProps> = ({
  className = "",
}) => {
  const { aiPanelOpen, toggleAIPanel } = useUIStore();
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      onClick={toggleAIPanel}
      title={aiPanelOpen ? "Close AI Assistant" : "Open AI Assistant"}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.05, y: -1 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
      transition={{ duration: 0.18, ease: EASE_AURORA }}
      className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
        aiPanelOpen
          ? "bg-primary/15 border border-primary/25 text-primary shadow-[0_0_12px_rgba(79,209,197,0.18)]"
          : "border border-border bg-surface/60 text-muted-foreground/70 hover:text-foreground hover:bg-surface hover:border-primary/20"
      } ${className}`}
    >
      {/* Animated glow ring when active */}
      {aiPanelOpen && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 rounded-lg bg-primary/5"
        />
      )}

      {/* Pulse dot when closed (invitation to open) */}
      {!aiPanelOpen && (
        <motion.span
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary border-2 border-background"
          animate={shouldReduceMotion ? undefined : {
            scale: [1, 1.3, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <span className="relative z-10 flex items-center gap-1.5">
        {aiPanelOpen ? (
          <BrainCircuit className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="hidden sm:block">
          {aiPanelOpen ? "AI Open" : "Ask AI"}
        </span>
      </span>
    </motion.button>
  );
};
