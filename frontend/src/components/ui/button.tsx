import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Global Timing: 200ms ease-out
// Global Micro Interactions: hover:-translate-y-[2px] hover:scale-[1.02] active:scale-[0.98]
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold transition-all duration-200 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:-translate-y-[2px] hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white animate-aurora border border-blue-500/10 btn-glow-primary",
        secondary: "bg-white/10 dark:bg-white/[0.04] border border-[#111827]/10 dark:border-white/[0.08] backdrop-blur-md text-foreground hover:bg-[#111827]/5 dark:hover:bg-white/[0.08] shadow-sm",
        ghost: "bg-transparent text-secondary-text hover:bg-[#111827]/5 dark:hover:bg-white/[0.05] hover:text-foreground",
        destructive: "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white",
        success: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white btn-glow-success",
        ai: "bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#3B82F6] hover:from-[#7C3AED] hover:via-[#DB2777] hover:to-[#2563EB] text-white animate-aurora border border-[#8B5CF6]/10 btn-glow-ai",
        toolbar: "bg-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground rounded-md",
        fab: "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white animate-aurora shadow-xl btn-glow-primary",
      },
      size: {
        sm: "h-9 px-4 text-xs rounded-[12px]",
        md: "h-11 px-5 text-sm rounded-[14px]",
        lg: "h-14 px-8 text-base rounded-[20px]",
        icon: "h-11 w-11 rounded-full p-0 flex items-center justify-center shrink-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      icon,
      iconPosition = "left",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current shrink-0"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && icon && iconPosition === "left" && (
          <span className="mr-2 inline-flex items-center justify-center shrink-0">{icon}</span>
        )}
        {children}
        {!isLoading && icon && iconPosition === "right" && (
          <span className="ml-2 inline-flex items-center justify-center shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

// ── ICON BUTTON ──
// Circular, Glass, centered icon, hover rotation (2–3°), soft glow.
const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, icon, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="secondary"
        size="icon"
        className={cn(
          "hover:rotate-[2.5deg] active:scale-[0.98] shadow-inner flex items-center justify-center bg-white/5 dark:bg-white/[0.04]",
          className
        )}
        {...props}
      >
        {icon || children}
      </Button>
    );
  }
);
IconButton.displayName = "IconButton";

// ── AI BUTTON ──
const AIButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ai"
        className={cn("font-bold tracking-wide", className)}
        {...props}
      />
    );
  }
);
AIButton.displayName = "AIButton";

// ── DANGER BUTTON ──
const DangerButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="destructive"
        className={cn(className)}
        {...props}
      />
    );
  }
);
DangerButton.displayName = "DangerButton";

// ── SUCCESS BUTTON ──
const SuccessButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="success"
        className={cn(className)}
        {...props}
      />
    );
  }
);
SuccessButton.displayName = "SuccessButton";

// ── GHOST BUTTON ──
const GhostButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        className={cn("hover:shadow-none hover:-translate-y-0 hover:scale-100 active:scale-95", className)}
        {...props}
      />
    );
  }
);
GhostButton.displayName = "GhostButton";

// ── TOOLBAR BUTTON ──
const ToolbarButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="toolbar"
        size="sm"
        className={cn("hover:shadow-none hover:-translate-y-0 hover:scale-100 rounded-md", className)}
        {...props}
      />
    );
  }
);
ToolbarButton.displayName = "ToolbarButton";

// ── FLOATING ACTION BUTTON ──
const FloatingActionButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="fab"
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full p-0 flex items-center justify-center shadow-2xl z-40 transition-transform duration-250 hover:-translate-y-1 hover:scale-105 active:scale-95",
          className
        )}
        {...props}
      />
    );
  }
);
FloatingActionButton.displayName = "FloatingActionButton";

export {
  Button,
  IconButton,
  AIButton,
  DangerButton,
  SuccessButton,
  GhostButton,
  ToolbarButton,
  FloatingActionButton,
  buttonVariants,
};
