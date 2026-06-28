import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { useUIStore } from "@/store/ui-store";
import { useKnowledgeSources } from "@/components/knowledge";
import { KnowledgeSourcePicker } from "@/components/knowledge";
import { 
  Sparkles, Loader2, RotateCw, 
  Award, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Flashcard {
  id: string;
  note_id: string;
  question: string;
  answer: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
}

type SourceType = "note" | "document";

export const FlashcardsPage: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { data: sources = [] } = useKnowledgeSources();

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<SourceType | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Loading states
  const [cardsLoading, setCardsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset selected state on workspace switch
  useEffect(() => {
    setSelectedSourceId(null);
    setSelectedSourceType(null);
    setFlashcards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [activeWorkspaceId]);

  // Auto-select active note if navigated from notes page
  useEffect(() => {
    if (sources.length > 0) {
      const activeId = useUIStore.getState().activeNoteId;
      if (activeId) {
        const found = sources.find((s) => s.id === activeId);
        if (found) {
          setSelectedSourceId(activeId);
          setSelectedSourceType(found.source_type);
          fetchFlashcards(found.source_type, activeId);
        }
      }
    }
  }, [sources]);

  // Load flashcards for selected source using the new unified backend route
  const fetchFlashcards = async (sourceType: SourceType, sourceId: string) => {
    setCardsLoading(true);
    try {
      const response = await apiClient.get(`/knowledge/${sourceType}/${sourceId}/flashcards`);
      setFlashcards(response.data);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      console.error("Error loading flashcards:", err);
    } finally {
      setCardsLoading(false);
    }
  };

  const handleSelectSource = (id: string, type: SourceType) => {
    setSelectedSourceId(id);
    setSelectedSourceType(type);
    fetchFlashcards(type, id);
  };

  // Keyboard Shortcuts (Space to flip, 1-5 to grade)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!selectedSourceId || flashcards.length === 0 || currentIndex >= flashcards.length) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === " ") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        const rating = parseInt(e.key);
        handleReview(rating);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedSourceId, flashcards, currentIndex, isSubmitting]);

  const handleGenerateCards = async () => {
    if (!selectedSourceId || !selectedSourceType) return;
    setIsGenerating(true);
    try {
      const response = await apiClient.post(`/knowledge/flashcards/generate`, {
        source_type: selectedSourceType,
        source_id: selectedSourceId,
      });
      setFlashcards(response.data);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      alert("Failed to auto-generate flashcards. Make sure the source has sufficient context text.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReview = async (rating: number) => {
    if (flashcards.length === 0 || isSubmitting) return;
    const card = flashcards[currentIndex];
    setIsSubmitting(true);

    try {
      await apiClient.post(`/ai/flashcards/${card.id}/review`, { rating });
      
      // Move to next card
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setIsSubmitting(false);
      }, 200);
    } catch (err) {
      alert("Failed to submit review.");
      console.error(err);
      setIsSubmitting(false);
    }
  };

  // Get the display name for the selected source
  const getSourceName = (): string => {
    if (!selectedSourceId) return "";
    const source = sources.find((s) => s.id === selectedSourceId);
    return source ? source.title : "Unknown Source";
  };

  const sourceName = getSourceName();

  // SuperMemo score descriptors
  const reviews = [
    { value: 1, label: "Forgot", color: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/25 dark:text-red-400 dark:bg-red-500/5" },
    { value: 2, label: "Vague", color: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/25 dark:text-orange-400 dark:bg-orange-500/5" },
    { value: 3, label: "Hard", color: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/25 dark:text-yellow-400 dark:bg-yellow-500/5" },
    { value: 4, label: "Good", color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/25 dark:text-blue-400 dark:bg-blue-500/5" },
    { value: 5, label: "Easy", color: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-500/5" }
  ];

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-1 md:grid-cols-4 gap-6 text-left animate-fadeIn">
      {/* Left Column: Knowledge Sources selector */}
      <div className="md:col-span-1 flex flex-col h-full overflow-hidden clay-panel bg-card/10">
        <KnowledgeSourcePicker
          selectedSourceId={selectedSourceId}
          onSelect={handleSelectSource}
        />
      </div>

      {/* Right Column: Flashcard Interface */}
      <div className="md:col-span-3 flex flex-col h-full overflow-hidden">
        <AnimatePresence mode="wait">
          {!selectedSourceId ? (
            <motion.div
              key="no-source"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col items-center justify-center text-center p-8 space-y-4 clay-panel h-full"
            >
              <Layers className="h-12 w-12 text-muted-foreground/45 animate-pulse" />
              <div>
                <h3 className="font-extrabold text-sm text-foreground">No source selected</h3>
                <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
                  Select a document or note from the Knowledge Sources panel to generate review flashcards.
                </p>
              </div>
            </motion.div>
          ) : cardsLoading ? (
            <motion.div
              key="loading-cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex items-center justify-center clay-panel h-full"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </motion.div>
          ) : flashcards.length === 0 ? (
            <motion.div
              key="generate-prompt"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-grow flex flex-col items-center justify-center text-center p-8 space-y-4 clay-panel h-full"
            >
              <div className="h-12 w-12 rounded-2xl bg-violet/10 flex items-center justify-center text-violet mb-2 shadow-inner">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-foreground">No flashcards found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                  "{sourceName}" does not have flashcards. Generate cards using AI to extract key concepts, definitions, and formulas.
                </p>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerateCards}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-5 py-3 text-xs font-bold clay-btn-primary disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" /> Generating Cards...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5" /> Generate AI Flashcards
                  </>
                )}
              </motion.button>
            </motion.div>
          ) : currentIndex >= flashcards.length ? (
            <motion.div
              key="finished-review"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-grow flex flex-col items-center justify-center text-center p-8 space-y-4 clay-panel h-full"
            >
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2 shadow-inner border border-emerald-500/20">
                <Award className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-foreground">Study Session Complete!</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                  Excellent! You have reviewed all {flashcards.length} flashcards. Spaced repetition dates are updated in the database.
                </p>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCurrentIndex(0)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold clay-btn bg-card/50"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Study Again
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGenerateCards}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold clay-btn-primary"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Regenerate Cards
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className="flex-grow flex flex-col justify-between h-full space-y-6">
              {/* Header Status */}
              <div className="flex justify-between items-center px-4">
                <div className="text-left">
                  <h3 className="font-extrabold text-sm truncate max-w-md text-foreground flex items-center gap-2">
                    <span>{selectedSourceType === "document" ? "📄" : "📝"}</span>
                    Studying: {sourceName}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Card {currentIndex + 1} of {flashcards.length}
                  </span>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGenerateCards}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold clay-btn bg-violet/10 text-violet border-violet/10 hover:bg-violet/20"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCw className="h-3 w-3" />
                  )}
                  Regenerate
                </motion.button>
              </div>

              {/* 3D Flip Card */}
              <div className="flex-grow flex items-center justify-center p-4">
                <div 
                  className="relative w-full max-w-xl h-64 cursor-pointer select-none"
                  style={{ perspective: "1000px" }}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <motion.div
                    className="w-full h-full relative"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  >
                    {/* Front of Card */}
                    <div 
                      className="absolute inset-0 w-full h-full rounded-3xl p-8 flex flex-col justify-center items-center text-center border border-border/40 clay-card bg-card/85 shadow-lg"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <span className="absolute top-4 left-4 p-1.5 rounded-lg bg-violet/10 text-violet text-[9px] font-extrabold uppercase tracking-wider">
                        Question
                      </span>
                      <p className="font-extrabold text-sm text-foreground max-w-md leading-relaxed">
                        {flashcards[currentIndex].question}
                      </p>
                      <span className="absolute bottom-4 text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                        <RotateCw className="h-3 w-3 animate-pulse text-primary" /> Click card to flip and reveal answer
                      </span>
                    </div>

                    {/* Back of Card */}
                    <div 
                      className="absolute inset-0 w-full h-full rounded-3xl p-8 flex flex-col justify-center items-center text-center border border-border/40 clay-card bg-card/90 shadow-lg"
                      style={{ 
                        backfaceVisibility: "hidden", 
                        transform: "rotateY(180deg)" 
                      }}
                    >
                      <span className="absolute top-4 left-4 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[9px] font-extrabold uppercase tracking-wider">
                        Answer
                      </span>
                      <p className="font-bold text-xs text-foreground max-w-md leading-relaxed whitespace-pre-wrap">
                        {flashcards[currentIndex].answer}
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Review Buttons Controls panel */}
              <div className="clay-panel p-4 border border-border/40 bg-card/40 shrink-0">
                <div className="flex flex-col items-center gap-3">
                  <h4 className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">
                    How well did you recall this card?
                  </h4>
                  
                  <div className="flex flex-wrap justify-center gap-2.5 w-full">
                    {reviews.map((rev) => (
                      <motion.button
                        key={rev.value}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleReview(rev.value)}
                        disabled={isSubmitting}
                        className={`flex-grow md:flex-grow-0 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all clay-btn ${rev.color}`}
                      >
                        {rev.value} - {rev.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
