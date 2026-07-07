import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Loader } from "../ui/Loader";

export interface TimelineStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
}

interface ProcessingTimelineProps {
  steps?: TimelineStep[];
  title?: string;
  className?: string;
}

const DEFAULT_STEPS: TimelineStep[] = [
  { id: "1", label: "Uploading", status: "completed" },
  { id: "2", label: "Extracting Text", status: "completed" },
  { id: "3", label: "Building Knowledge", status: "completed" },
  { id: "4", label: "Creating Flashcards", status: "active" },
  { id: "5", label: "Creating Quiz", status: "pending" },
];

export const ProcessingTimeline: React.FC<ProcessingTimelineProps> = ({
  steps = DEFAULT_STEPS,
  title = "AI Document Ingestion Pipeline",
  className = "",
}) => {
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const containerVariants = {
    initial: {},
    animate: {
      transition: { staggerChildren: 0.12 },
    },
  };

  const itemVariants = {
    initial: { opacity: 0, x: -10 },
    animate: { 
      opacity: 1, 
      x: 0,
      transition: { type: "spring", stiffness: 140, damping: 15 }
    },
  };

  return (
    <motion.div
      variants={shouldReduceMotion ? {} : containerVariants}
      initial="initial"
      animate="animate"
      className={`glass-panel p-6 max-w-sm w-full bg-white/[0.015] border border-white/[0.03] backdrop-blur-md shadow-lg rounded-2xl ${className}`}
    >
      <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground/50 border-b border-white/[0.02] pb-3 mb-5 text-left">
        {title}
      </h3>

      <div className="relative flex flex-col gap-6 pl-2">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const status = step.status;

          // Resolve styling based on stage status
          let icon = null;
          let labelColor = "text-muted-foreground/45";
          let circleColor = "border-white/10 bg-white/[0.01]";

          if (status === "completed") {
            icon = (
              <motion.div
                initial={shouldReduceMotion ? {} : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </motion.div>
            );
            labelColor = "text-emerald-500/85 font-medium";
            circleColor = "border-emerald-500/20 bg-emerald-500/5";
          } else if (status === "active") {
            icon = <Loader size="sm" />;
            labelColor = "text-primary font-semibold";
            circleColor = "border-primary bg-primary/10 shadow-[0_0_10px_rgba(93,124,255,0.2)]";
          } else if (status === "failed") {
            icon = <AlertCircle className="h-4 w-4 text-red-500" />;
            labelColor = "text-red-500/85 font-medium";
            circleColor = "border-red-500/20 bg-red-500/5";
          } else {
            // Pending
            icon = <Clock className="h-3 w-3 text-muted-foreground/30" />;
            labelColor = "text-muted-foreground/35";
            circleColor = "border-white/[0.04] bg-white/[0.005]";
          }

          return (
            <motion.div
              key={step.id}
              variants={shouldReduceMotion ? {} : itemVariants}
              className="flex items-start gap-4 relative"
            >
              {/* Connecting Vertical line */}
              {!isLast && (
                <div 
                  className={`absolute left-3 top-6 w-[1.5px] -bottom-6 z-0 ${
                    status === "completed" ? "bg-emerald-500/30" : "bg-white/[0.04]"
                  }`}
                />
              )}

              {/* Status Circle Icon */}
              <div 
                className={`relative z-10 h-6.5 w-6.5 rounded-full flex items-center justify-center border transition-all duration-300 ${circleColor}`}
              >
                {icon}
              </div>

              {/* Stage label text */}
              <div className="flex-grow pt-0.5 text-left">
                <span className={`text-[11.5px] tracking-wide transition-colors duration-300 ${labelColor}`}>
                  {step.label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
