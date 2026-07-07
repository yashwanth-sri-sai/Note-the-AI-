import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrainCircuit, BookOpen, Tag, Star, ArrowRight, Sparkles, FolderKanban } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[400px] right-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>

      {/* Top Header */}
      <header className="sticky top-0 z-50 w-full glass-panel transition-all duration-300">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer" onClick={() => navigate("/")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-md shadow-primary/20">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">NoteAI</span>
          </div>

          <nav className="flex items-center gap-6">
            <ThemeToggle compact />

            {isAuthenticated ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary/95 hover:shadow-primary/45 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors">
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/95 transition-all hover:-translate-y-0.5"
                >
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-6 pt-20 pb-24 text-center">
        <div className="animate-fadeIn flex flex-col items-center">
          {/* Badge */}
          <div className="mb-6 flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1 text-xs font-semibold tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Phase 1 Foundation Live
          </div>

          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight md:text-7xl leading-tight">
            The next generation of
            <span className="block bg-gradient-to-r from-primary via-indigo-500 to-purple-500 bg-clip-text text-transparent">
              AI-Powered Knowledge
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            A beautiful, friction-free markdown environment for notes, organized by folders and tags, and optimized for upcoming semantic retrieval and flashcards.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/register")}
              className="flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white shadow-xl shadow-primary/35 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </button>
            <a
              href="#features"
              className="rounded-xl border border-border px-8 py-4 text-base font-semibold hover:bg-muted/50 transition-colors"
            >
              Explore Features
            </a>
          </div>
        </div>

        {/* Dashboard Teaser Grid Mock */}
        <div className="mt-20 glass-panel rounded-2xl p-4 shadow-2xl border border-border/60 max-w-5xl mx-auto overflow-hidden animate-fadeIn relative">
          <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4 px-2">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
              <span className="h-3 w-3 rounded-full bg-yellow-500/80"></span>
              <span className="h-3 w-3 rounded-full bg-green-500/80"></span>
            </div>
            <div className="rounded-lg bg-muted px-8 py-1 text-xs text-muted-foreground w-1/3 truncate">
              noteai.app/dashboard/recent-notes
            </div>
            <div className="h-3 w-3"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
            {/* Sidebar Mock */}
            <div className="col-span-1 border-r border-border/40 pr-4 space-y-5 hidden md:block">
              <div className="space-y-2">
                <div className="h-8 rounded-lg bg-primary/10 flex items-center px-3 gap-2 text-xs font-semibold text-primary">
                  <BrainCircuit className="h-3.5 w-3.5" /> Dashboard
                </div>
                <div className="h-8 rounded-lg hover:bg-muted/40 flex items-center px-3 gap-2 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" /> My Notes
                </div>
                <div className="h-8 rounded-lg hover:bg-muted/40 flex items-center px-3 gap-2 text-xs text-muted-foreground">
                  <FolderKanban className="h-3.5 w-3.5" /> Folders
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-2 px-3">Folders</p>
                <div className="space-y-1.5 px-3">
                  <div className="h-4 w-2/3 bg-muted rounded"></div>
                  <div className="h-4 w-1/2 bg-muted rounded"></div>
                </div>
              </div>
            </div>

            {/* Content Mock */}
            <div className="col-span-3 space-y-4">
              <div className="h-10 bg-muted/60 rounded-xl flex items-center justify-between px-4">
                <div className="h-4 w-1/3 bg-muted rounded"></div>
                <span className="h-6 w-6 rounded-full bg-muted"></span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border/80 rounded-xl p-4 space-y-3 hover:border-primary/50 transition-colors bg-card">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-sm">💡 Project Ideas</h3>
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    - Build NoteAI SaaS dashboard prototype.<br />
                    - Connect SQLAlchemy models and run autogenerated migrations.<br />
                    - Setup OAuth login redirect handlers.
                  </p>
                  <div className="flex gap-2">
                    <span className="h-5 rounded bg-primary/10 text-primary text-[10px] px-2 py-0.5">NoteAI</span>
                    <span className="h-5 rounded bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5">Urgent</span>
                  </div>
                </div>

                <div className="border border-border/80 rounded-xl p-4 space-y-3 hover:border-primary/50 transition-colors bg-card">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-sm">🚀 Learning Next.js</h3>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    Read the documentation regarding React Server Components (RSC) and server actions. Try out layout file structure.
                  </p>
                  <div className="flex gap-2">
                    <span className="h-5 rounded bg-primary/10 text-primary text-[10px] px-2 py-0.5">Study</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="bg-muted/40 py-20 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center md:text-4xl">
            Everything you need for premium notes management
          </h2>
          <p className="mt-4 text-center text-muted-foreground max-w-xl mx-auto">
            Experience writing, structuring, and cataloging information with a system engineered for efficiency.
          </p>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <BookOpen className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-bold">Rich Text Markdown</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Write formatting-rich text instantly using markdown commands. Code blocks, listings, tables, links, and bold formats are fully supported.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 mb-4">
                <FolderKanban className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-bold">Nested Folder Organization</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Catalog notes within custom folder structures. Move notes instantly between folders and maintain clean hierarchy.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 mb-4">
                <Tag className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-bold">Custom Label Tagging</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Tag your notes with colorful labels. Dynamic filters in the sidebar let you view tag collections at a glance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-background">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 NoteAI SaaS. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
