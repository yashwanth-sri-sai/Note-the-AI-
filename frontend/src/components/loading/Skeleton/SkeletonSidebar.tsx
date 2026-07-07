import React from "react";

interface SkeletonSidebarProps {
  itemsCount?: number;
}

export const SkeletonSidebar: React.FC<SkeletonSidebarProps> = ({ itemsCount = 6 }) => {
  return (
    <div className="w-full flex flex-col gap-5 animate-pulse select-none p-3">
      {/* Header Profile shimmer */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.02]">
        <div className="h-8 w-8 rounded-full bg-white/[0.04] shrink-0" />
        <div className="space-y-1.5 flex-grow">
          <div className="h-3 w-24 rounded bg-white/[0.04]" />
          <div className="h-2.5 w-16 rounded bg-white/[0.02]" />
        </div>
      </div>

      {/* Navigation List items */}
      <div className="space-y-3 flex-grow">
        {Array.from({ length: itemsCount }).map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 py-1 px-1">
            <div className="h-4.5 w-4.5 rounded bg-white/[0.03] shrink-0" />
            <div className="h-3.5 w-2/3 rounded bg-white/[0.02] flex-grow" />
          </div>
        ))}
      </div>

      {/* Workspace details footer */}
      <div className="pt-4 border-t border-white/[0.02] flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-white/[0.03] shrink-0" />
        <div className="h-3 w-28 rounded bg-white/[0.02]" />
      </div>
    </div>
  );
};
