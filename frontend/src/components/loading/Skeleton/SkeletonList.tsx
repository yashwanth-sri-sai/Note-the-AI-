import React from "react";

interface SkeletonListProps {
  rowsCount?: number;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ rowsCount = 5 }) => {
  return (
    <div className="w-full flex flex-col gap-4.5 animate-pulse select-none p-1">
      {Array.from({ length: rowsCount }).map((_, i) => (
        <div
          key={i}
          className="p-4 flex items-center justify-between gap-4 border border-white/[0.02] bg-white/[0.005] rounded-xl"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-grow text-left">
            {/* Shimmer icon box */}
            <div className="h-9 w-9 rounded-xl bg-white/[0.03] border border-white/[0.04] shrink-0" />
            <div className="space-y-2 flex-grow min-w-0">
              {/* Row title shimmer */}
              <div className="h-3.5 w-1/3 rounded bg-white/[0.04]" />
              {/* Row description/content shimmer */}
              <div className="h-2.5 w-2/3 rounded bg-white/[0.02] truncate" />
            </div>
          </div>
          {/* Metadata pills / status actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-2 w-10 rounded bg-white/[0.02] hidden sm:block" />
            <div className="h-5 w-14 rounded-full bg-white/[0.03] border border-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
};
