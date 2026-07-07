import React from "react";

interface SkeletonCardProps {
  className?: string;
  hasIcon?: boolean;
  hasFooter?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className = "",
  hasIcon = true,
  hasFooter = true,
}) => {
  return (
    <div
      className={`clay-card p-5 space-y-4 animate-pulse select-none bg-white/[0.015] border border-white/[0.03] shadow-sm rounded-2xl ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 w-full">
          {hasIcon && (
            <div className="h-9 w-9 rounded-xl bg-white/[0.03] shrink-0" />
          )}
          <div className="space-y-2 flex-grow">
            <div className="h-3.5 w-3/4 rounded bg-white/[0.04]" />
            <div className="h-2.5 w-1/2 rounded bg-white/[0.02]" />
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="h-2.5 w-full rounded bg-white/[0.02]" />
        <div className="h-2.5 w-[90%] rounded bg-white/[0.02]" />
        <div className="h-2.5 w-[75%] rounded bg-white/[0.02]" />
      </div>

      {hasFooter && (
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.02]">
          <div className="h-2 w-16 rounded bg-white/[0.03]" />
          <div className="h-5 w-12 rounded-full bg-white/[0.03]" />
        </div>
      )}
    </div>
  );
};
