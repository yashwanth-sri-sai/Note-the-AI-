import React from "react";
import { SkeletonCard } from "../loading/Skeleton/SkeletonCard";
import { SkeletonList } from "../loading/Skeleton/SkeletonList";

export const PageSkeleton: React.FC = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  // Custom structure for Chat Page
  if (path.includes("/chat")) {
    return (
      <div className="w-full h-full flex flex-col gap-4 animate-pulse p-2">
        <div className="h-10 w-44 rounded bg-white/[0.04] mb-2" />
        <div className="flex-grow flex flex-col gap-4.5 bg-white/[0.01] border border-white/[0.03] rounded-2xl p-5">
          <div className="flex justify-start w-3/4">
            <div className="h-10 w-full rounded-2xl bg-white/[0.03]" />
          </div>
          <div className="flex justify-end w-2/3 ml-auto">
            <div className="h-10 w-full rounded-2xl bg-white/[0.04]" />
          </div>
          <div className="flex justify-start w-1/2">
            <div className="h-16 w-full rounded-2xl bg-white/[0.03]" />
          </div>
          <div className="flex justify-start w-2/3">
            <div className="h-10 w-full rounded-2xl bg-white/[0.03]" />
          </div>
          <div className="flex justify-end w-1/2 ml-auto">
            <div className="h-12 w-full rounded-2xl bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-11 w-full rounded-xl bg-white/[0.02] border border-white/[0.04]" />
      </div>
    );
  }

  // Custom structure for Settings Page
  if (path.includes("/settings")) {
    return (
      <div className="w-full h-full flex flex-col gap-6 animate-pulse p-2 text-left">
        <div className="space-y-2 pb-4 border-b border-white/[0.02]">
          <div className="h-4.5 w-32 rounded bg-white/[0.04]" />
          <div className="h-3 w-56 rounded bg-white/[0.02]" />
        </div>
        <div className="max-w-2xl space-y-6">
          <div className="space-y-3">
            <div className="h-3.5 w-24 rounded bg-white/[0.04]" />
            <div className="h-10 w-full rounded-lg bg-white/[0.02] border border-white/[0.03]" />
          </div>
          <div className="space-y-3">
            <div className="h-3.5 w-32 rounded bg-white/[0.04]" />
            <div className="h-10 w-full rounded-lg bg-white/[0.02] border border-white/[0.03]" />
          </div>
          <div className="space-y-3">
            <div className="h-3.5 w-28 rounded bg-white/[0.04]" />
            <div className="h-20 w-full rounded-lg bg-white/[0.02] border border-white/[0.03]" />
          </div>
          <div className="h-10 w-24 rounded-lg bg-white/[0.03] pt-4" />
        </div>
      </div>
    );
  }

  // Custom structure for Analytics Page
  if (path.includes("/analytics")) {
    return (
      <div className="w-full h-full flex flex-col gap-6 animate-pulse p-2">
        <div className="flex justify-between items-center pb-4 border-b border-white/[0.02]">
          <div className="space-y-2">
            <div className="h-4.5 w-36 rounded bg-white/[0.04]" />
            <div className="h-3 w-48 rounded bg-white/[0.02]" />
          </div>
        </div>
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.03] bg-white/[0.01] p-4 space-y-2">
              <div className="h-3 w-16 rounded bg-white/[0.04]" />
              <div className="h-5 w-24 rounded bg-white/[0.03]" />
            </div>
          ))}
        </div>
        {/* Analytics simulated charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl border border-white/[0.03] bg-white/[0.01]" />
          <div className="h-64 rounded-2xl border border-white/[0.03] bg-white/[0.01]" />
        </div>
      </div>
    );
  }

  // Custom structure for Notes & Documents Page (Card grids)
  if (path.includes("/notes") || path.includes("/documents") || path.includes("/favorites")) {
    return (
      <div className="w-full h-full flex flex-col gap-5 animate-pulse p-2">
        <div className="flex justify-between items-center pb-4 border-b border-white/[0.02]">
          <div className="space-y-2">
            <div className="h-4.5 w-40 rounded bg-white/[0.04]" />
            <div className="h-3 w-60 rounded bg-white/[0.02]" />
          </div>
          <div className="h-9 w-28 rounded-lg bg-white/[0.03]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // Fallback for Folders, Tags, and others (List view skeleton)
  return (
    <div className="w-full h-full flex flex-col gap-5 animate-pulse p-2">
      <div className="flex justify-between items-center pb-4 border-b border-white/[0.02]">
        <div className="space-y-2">
          <div className="h-4.5 w-32 rounded bg-white/[0.04]" />
          <div className="h-3 w-56 rounded bg-white/[0.02]" />
        </div>
        <div className="h-8.5 w-24 rounded-lg bg-white/[0.03]" />
      </div>
      <SkeletonList rowsCount={6} />
    </div>
  );
};
