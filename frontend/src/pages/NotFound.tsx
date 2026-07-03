import React from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, Home } from "lucide-react";

export const NotFound: React.FC = () => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center text-center max-w-md px-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
          <BrainCircuit className="h-7 w-7" />
        </span>
        <h1 className="text-6xl font-black tracking-tight text-primary mb-2">404</h1>
        <h2 className="text-xl font-bold tracking-tight text-foreground/90 mb-4">
          Lost in Workspace Orbit
        </h2>
        <p className="text-xs text-muted-foreground/60 leading-relaxed mb-8">
          The workspace node or page you are looking for does not exist, has been moved, or is completely offline. Let's get you back.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-xs font-semibold text-white transition-colors duration-150 shadow-[0_4px_12px_rgba(93,124,255,0.2)]"
        >
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
