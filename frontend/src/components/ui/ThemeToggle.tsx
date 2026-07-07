import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";
import { useUIStore } from "@/store/ui-store";

type ThemeMode = "light" | "dark" | "system";

interface ThemeToggleProps {
  /** Show text label next to the icon (default: false) */
  showLabel?: boolean;
  /** Compact mode — smaller, icon-only pill (default: false) */
  compact?: boolean;
}

const MODE_META: Record<ThemeMode, { icon: React.FC<{ className?: string }>; label: string; next: ThemeMode }> = {
  light:  { icon: Sun,     label: "Light",  next: "dark"   },
  dark:   { icon: Moon,    label: "Dark",   next: "system" },
  system: { icon: Monitor, label: "System", next: "light"  },
};

/**
 * Premium animated Sun / Moon / System theme toggle.
 * Cycles: light → dark → system → light
 * Persists to localStorage. Respects prefers-reduced-motion.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showLabel = false,
  compact = false,
}) => {
  const { theme, setTheme } = useUIStore();
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("themeMode") : null;
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    return theme === "dark" ? "dark" : "light";
  });

  const shouldReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Apply effective theme to document and store */
  const applyTheme = useCallback((m: ThemeMode) => {
    if (m === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    } else {
      setTheme(m);
    }
  }, [setTheme]);

  /** OS preference listener for system mode */
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, setTheme]);

  const handleCycle = () => {
    const next = MODE_META[mode].next;
    setMode(next);
    localStorage.setItem("themeMode", next);
    applyTheme(next);
  };

  const IconComponent = MODE_META[mode].icon;
  const label = MODE_META[mode].label;

  // Track color: light = sky-100, dark = slate-800, system = purple-900
  const trackColor: Record<ThemeMode, string> = {
    light:  "hsl(207, 73%, 94%)",
    dark:   "hsl(217, 40%, 14%)",
    system: "hsl(260, 40%, 20%)",
  };

  // Icon color per mode
  const iconColor: Record<ThemeMode, string> = {
    light:  "hsl(42, 90%, 50%)",   // warm amber sun
    dark:   "hsl(230, 80%, 72%)",  // cool indigo moon
    system: "hsl(260, 60%, 75%)",  // soft purple monitor
  };

  return (
    <motion.button
      onClick={handleCycle}
      role="switch"
      aria-checked={mode === "dark"}
      aria-label={`Theme: ${label}. Click to switch.`}
      title={`Theme: ${label}`}
      whileHover={shouldReduceMotion ? {} : { scale: 1.04 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.93 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={`
        relative inline-flex items-center gap-2 select-none
        rounded-xl border transition-colors duration-300 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${compact ? "h-8 px-2.5" : "h-9 px-3.5"}
      `}
      style={{
        background: trackColor[mode],
        borderColor: mode === "light"
          ? "rgba(20,32,51,0.10)"
          : mode === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(180,140,255,0.20)",
        boxShadow: mode === "dark"
          ? "0 0 12px rgba(79,209,197,0.10)"
          : mode === "system"
          ? "0 0 12px rgba(180,140,255,0.12)"
          : "0 2px 8px rgba(20,32,51,0.08)",
      }}
    >
      {/* Icon container — uses AnimatePresence for smooth swap */}
      <div className={`relative ${compact ? "h-4 w-4" : "h-4.5 w-4.5"} shrink-0`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode}
            initial={shouldReduceMotion ? {} : { opacity: 0, rotate: -45, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={shouldReduceMotion ? {} : { opacity: 0, rotate: 45, scale: 0.6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <IconComponent
              className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
              style={{ color: iconColor[mode] } as React.CSSProperties}
            />
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Label — optional */}
      {showLabel && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`label-${mode}`}
            initial={shouldReduceMotion ? {} : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? {} : { opacity: 0, x: 4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`font-semibold tabular-nums ${compact ? "text-[10px]" : "text-[11px]"}`}
            style={{ color: iconColor[mode] }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      )}
    </motion.button>
  );
};
