import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { Note } from "@/types";
import { 
  Sparkles, Check, HelpCircle, Loader2, RotateCw, 
  ArrowRight, Award, ChevronRight, BookOpen, Layers
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

export const FlashcardsPage: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Loading states
  const [notesLoading, setNotesLoading] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load workspace notes on mount/workspace change
  useEffect(() => {
    const fetchNotes = async () => {
      setNotesLoading(true);
      try {
        const response = await apiClient.get("/notes/");
        setNotes(response.data);
        // Reset selected note on workspace switch
        setSelectedNoteId(null);
        setFlashcards([]);
      } catch (err) {
        console.error("Error fetching notes for flashcards:", err);
      } finally {
        setNotesLoading(false);
      }
    };

    if (activeWorkspaceId) {
      fetchNotes();
    }
  }, [activeWorkspaceId]);

  // Load flashcards for selected note
  const fetchFlashcards = async (noteId: string) => {
    setCardsLoading(true);
    try {
      const response = await apiClient.get(`/ai/notes/${noteId}/flashcards`);
      setFlashcards(response.data);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      console.error("Error loading flashcards:", err);
    } finally {
      setCardsLoading(false);
    }
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    fetchFlashcards(noteId);
  };

  const handleGenerateCards = async () => {
    if (!selectedNoteId) return;
    setIsGenerating(true);
    try {
      const response = await apiClient.post(`/ai/notes/${selectedNoteId}/flashcards/generate`);
      setFlashcards(response.data);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      alert("Failed to auto-generate flashcards. Make sure the note has sufficient context text.");
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
      // Wait for flip transition before updating index
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

  const activeNote = notes.find((n) => n.id === selectedNoteId);

  // SuperMemo score descriptors
  const reviews = [
    { value: 1, label: "Forgot", color: "bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:scale-105 border-red-500/25" },
    { value: 2, label: "Vague", color: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 hover:scale-105 border-orange-500/25" },
    { value: 3, label: "Hard", color: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 hover:scale-105 border-yellow-500/25" },
    { value: 4, label: "Good", color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:scale-105 border-blue-500/25" },
    { value: 5, label: "Easy", color: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:scale-105 border-emerald-500/25" }
  ];

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Left Column: Note list selector */}
      <div className="md:col-span-1 flex flex-col h-full overflow-hidden clay-panel bg-card/10">
        <div className="p-4 border-b border-border/40 shrink-0">
          <h3 className="font-bold text-xs uppercase text-muted-foreground/80 tracking-wider">
            Select Notebook Note
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Choose a note to study spaced flashcards.
          </p>
        </div>

        <div className="flex-grow overflow-y-auto p-2 space-y-1 scrollbar">
          {notesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-center py-10 text-xs text-muted-foreground">
              No notes created yet.
            </p>
          ) : (
            notes.map((n) => (
              <button
                key={n.id}
                onClick={() => handleSelectNote(n.id)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between text-xs font-semibold ${
                  selectedNoteId === n.id
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="truncate pr-2">{n.title || "Untitled Note"}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Flashcard Interface */}
      <div className="md:col-span-3 flex flex-col h-full overflow-hidden">
        <AnimatePresence mode="wait">
          {!selectedNoteId ? (
            <motion.div
              key="no-note"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col items-center justify-center text-center p-8 space-y-3.5 clay-panel h-full"
            >
              <Layers className="h-10 w-10 text-muted-foreground/50 animate-pulse" />
              <h3 className="font-bold text-sm">No notebook chosen</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Select a note from the side panel to generate review flashcards or load current cards.
              </p>
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
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-2 shadow-inner">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-sm">No flashcards found</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                "{activeNote?.title}" does not have flashcards. Generate cards using AI to extract key concepts, definitions, and formulas.
              </p>
              
              <button
                onClick={handleGenerateCards}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold clay-btn-primary disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating Cards...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate AI Flashcards
                  </>
                )}
              </button>
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
              <h3 className="font-extrabold text-base">Study Session Complete!</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Excellent! You have reviewed all {flashcards.length} flashcards for this note. Spaced repetition dates are updated in the database.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentIndex(0)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold clay-btn bg-card/50"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Study Again
                </button>
                <button
                  onClick={handleGenerateCards}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold clay-btn-primary"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Regenerate Cards
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex-grow flex flex-col justify-between h-full space-y-6">
              {/* Header Status */}
              <div className="flex justify-between items-center px-4">
                <div className="text-left">
                  <h3 className="font-bold text-sm truncate max-w-md">
                    Studying: {activeNote?.title}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    Card {currentIndex + 1} of {flashcards.length}
                  </span>
                </div>
                
                <button
                  onClick={handleGenerateCards}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold clay-btn bg-indigo-500/10 text-indigo-500 border-indigo-500/10 hover:bg-indigo-500/20"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCw className="h-3 w-3" />
                  )}
                  Regenerate
                </button>
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
                      className="absolute inset-0 w-full h-full rounded-3xl p-8 flex flex-col justify-center items-center text-center backface-hidden border border-border/40 clay-card bg-card/85"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <span className="absolute top-4 left-4 p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 text-[9px] font-bold uppercase tracking-wider">
                        Question
                      </span>
                      <p className="font-extrabold text-sm text-foreground max-w-md leading-relaxed">
                        {flashcards[currentIndex].question}
                      </p>
                      <span className="absolute bottom-4 text-[10px] text-muted-foreground flex items-center gap-1">
                        <RotateCw className="h-3 w-3 animate-pulse" /> Click card to flip and reveal answer
                      </span>
                    </div>

                    {/* Back of Card */}
                    <div 
                      className="absolute inset-0 w-full h-full rounded-3xl p-8 flex flex-col justify-center items-center text-center backface-hidden border border-border/40 clay-card bg-card/90"
                      style={{ 
                        backfaceVisibility: "hidden", 
                        transform: "rotateY(180deg)" 
                      }}
                    >
                      <span className="absolute top-4 left-4 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-wider">
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
                  <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    How well did you recall this card?
                  </h4>
                  
                  <div className="flex flex-wrap justify-center gap-2.5 w-full">
                    {reviews.map((rev) => (
                      <button
                        key={rev.value}
                        onClick={() => handleReview(rev.value)}
                        disabled={isSubmitting}
                        className={`flex-grow md:flex-grow-0 px-4 py-2 text-xs font-semibold rounded-xl border transition-all clay-btn ${rev.color}`}
                      >
                        {rev.value} - {rev.label}
                      </button>
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
