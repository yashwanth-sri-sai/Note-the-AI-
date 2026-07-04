import React from "react";

export const PageSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col gap-6 animate-pulse p-2">
      {/* Skeleton Page Header */}
      <div className="flex justify-between items-center pb-4 border-b border-white/[0.02]">
        <div className="space-y-2">
          <div className="h-4.5 w-36 rounded bg-white/[0.04]" />
          <div className="h-3 w-48 rounded bg-white/[0.02]" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-white/[0.03]" />
      </div>

      {/* Skeleton KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-white/[0.03] bg-white/[0.01] p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-white/[0.04]" />
            <div className="h-5 w-24 rounded bg-white/[0.03]" />
          </div>
        ))}
      </div>

      {/* Skeleton Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
        <div className="md:col-span-2 space-y-4">
          <div className="h-64 rounded-xl border border-white/[0.03] bg-white/[0.01]" />
          <div className="h-48 rounded-xl border border-white/[0.03] bg-white/[0.01]" />
        </div>
        <div className="h-full min-h-[300px] rounded-xl border border-white/[0.03] bg-white/[0.01]" />
      </div>
    </div>
  );
};
