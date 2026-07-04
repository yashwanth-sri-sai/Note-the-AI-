import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { useUIStore } from "@/store/ui-store";
import { useKnowledgeSources } from "@/components/knowledge";
import { KnowledgeSourcePicker } from "@/components/knowledge";
import { 
  Sparkles, Check, HelpCircle, Loader2, Award, 
  ChevronRight, X, CheckSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface QuizQuestion {
  id: string;
  question_text: string;
  choices: string[];
}

interface Quiz {
  id: string;
  note_id: string;
  title: string;
  questions: QuizQuestion[];
  created_at: string;
}

interface QuestionResult {
  is_correct: boolean;
  correct_answer: string;
  user_answer: string;
  explanation: string;
}

interface SubmissionResponse {
  quiz_id: string;
  score: number;
  total_questions: number;
  results: Record<string, QuestionResult>;
}

type SourceType = "note" | "document";

export const QuizzesPage: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { data: sources = [] } = useKnowledgeSources();

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<SourceType | null>(null);
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);

  // Loading states
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset selected state on workspace switch
  useEffect(() => {
    setSelectedSourceId(null);
    setSelectedSourceType(null);
    setQuizzes([]);
    setActiveQuiz(null);
    setSubmissionResult(null);
    setSelectedAnswers({});
    setQuizzesError(null);
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
          fetchQuizzes(found.source_type, activeId);
        }
      }
    }
  }, [sources]);

  // Load quizzes for selected source using the new unified backend route
  const fetchQuizzes = async (sourceType: SourceType, sourceId: string) => {
    setQuizzesLoading(true);
    setQuizzesError(null);
    try {
      const response = await apiClient.get(`/knowledge/${sourceType}/${sourceId}/quizzes`);
      setQuizzes(response.data);
      setActiveQuiz(null);
      setSubmissionResult(null);
      setSelectedAnswers({});
    } catch (err) {
      console.error("Error loading quizzes:", err);
      setQuizzesError("Failed to load quizzes. Please check your network connection and retry.");
    } finally {
      setQuizzesLoading(false);
    }
  };

  const handleSelectSource = (id: string, type: SourceType) => {
    setSelectedSourceId(id);
    setSelectedSourceType(type);
    fetchQuizzes(type, id);
  };

  const handleGenerateQuiz = async () => {
    if (!selectedSourceId || !selectedSourceType) return;
    setIsGenerating(true);
    try {
      const response = await apiClient.post(`/knowledge/quizzes/generate`, {
        source_type: selectedSourceType,
        source_id: selectedSourceId,
      });
      const newQuiz = response.data;
      setQuizzes((prev) => [newQuiz, ...prev]);
      setActiveQuiz(newQuiz);
      setSelectedAnswers({});
      setSubmissionResult(null);
    } catch (err) {
      alert("Failed to generate quiz. Check that the source has sufficient text context.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (questionId: string, choice: string) => {
    if (submissionResult) return; // Locked after submit
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: choice,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz || isSubmitting) return;

    const unanswered = activeQuiz.questions.some((q) => !selectedAnswers[q.id]);
    if (unanswered) {
      if (!confirm("You have not answered all questions. Submit anyway?")) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post(`/ai/quizzes/${activeQuiz.id}/submit`, {
        answers: selectedAnswers,
      });
      setSubmissionResult(response.data);
    } catch (err) {
      alert("Failed to submit quiz grading request.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    setSelectedAnswers({});
    setSubmissionResult(null);
  };

  // Get the display name for the selected source
  const getSourceName = (): string => {
    if (!selectedSourceId) return "";
    const source = sources.find((s) => s.id === selectedSourceId);
    return source ? source.title : "Unknown Source";
  };

  const sourceName = getSourceName();

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  } as const;

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-1 md:grid-cols-4 gap-6 text-left animate-fadeIn">
      {/* Left Column: Knowledge Sources selector */}
      <div className="md:col-span-1 flex flex-col h-full overflow-hidden clay-panel bg-card/10">
        <KnowledgeSourcePicker
          selectedSourceId={selectedSourceId}
          onSelect={handleSelectSource}
        />
      </div>

      {/* Right Column: Quiz Workspace */}
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
              <CheckSquare className="h-12 w-12 text-muted-foreground/45 animate-pulse" />
              <div>
                <h3 className="font-extrabold text-sm text-foreground">No source selected</h3>
                <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
                  Select a document or note from the Knowledge Sources panel to generate evaluation quizzes.
                </p>
              </div>
            </motion.div>
          ) : quizzesLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col p-6 space-y-4 clay-panel h-full"
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/[0.02] animate-pulse">
                <div className="h-4 w-32 rounded bg-white/[0.04]" />
                <div className="h-8 w-24 rounded-lg bg-white/[0.03]" />
              </div>
              <div className="space-y-3 flex-grow overflow-y-auto">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-5 rounded-2xl border border-white/[0.03] bg-white/[0.01] space-y-2 animate-pulse">
                    <div className="h-3.5 w-1/3 rounded bg-white/[0.04]" />
                    <div className="h-2.5 w-1/4 rounded bg-white/[0.02]" />
                  </div>
                ))}
              </div>
            </motion.div>
          ) : quizzesError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col items-center justify-center text-center p-8 space-y-3 clay-panel h-full"
            >
              <p className="text-xs text-red-400 font-semibold">{quizzesError}</p>
              <button
                onClick={() => fetchQuizzes(selectedSourceType!, selectedSourceId!)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.02] text-xs font-bold text-foreground transition-all duration-150"
              >
                Try Again
              </button>
            </motion.div>
          ) : !activeQuiz ? (
            <motion.div
              key="quiz-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col h-full overflow-hidden clay-panel"
            >
              <div className="p-4 border-b border-border/40 flex justify-between items-center bg-card/10 shrink-0">
                <div className="text-left">
                  <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                    <span>{selectedSourceType === "document" ? "📄" : "📝"}</span>
                    Quizzes for: {sourceName}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Select a quiz below or generate a new one.</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGenerateQuiz}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold clay-btn-primary disabled:opacity-50 shadow-sm"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Generate Quiz
                </motion.button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-3 scrollbar text-left">
                {quizzes.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <HelpCircle className="h-8 w-8 text-muted-foreground/35 mx-auto" />
                    <p className="text-xs text-muted-foreground">No quizzes generated for this source yet.</p>
                  </div>
                ) : (
                  quizzes.map((q) => (
                    <motion.div
                      key={q.id}
                      whileHover={{ scale: 1.01, y: -1 }}
                      onClick={() => setActiveQuiz(q)}
                      className="clay-card p-4.5 flex justify-between items-center cursor-pointer hover:border-rose/45 bg-card/65"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-foreground">{q.title}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                          {q.questions.length} Questions • Generated on {new Date(q.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/80" />
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="active-quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-grow flex flex-col h-full overflow-hidden clay-panel"
            >
              {/* Header */}
              <div className="p-4 border-b border-border/40 flex justify-between items-center bg-card/10 shrink-0">
                <div className="text-left min-w-0">
                  <h3 className="font-black text-sm truncate text-foreground">{activeQuiz.title}</h3>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 flex items-center gap-1">
                    <span>{selectedSourceType === "document" ? "📄" : "📝"}</span>
                    {sourceName}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setActiveQuiz(null);
                    setSubmissionResult(null);
                  }}
                  className="p-1.5 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground clay-btn bg-card/30"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              {/* Quiz Body */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar text-left">
                {/* Result Summary (shown post-submission) */}
                {submissionResult && (
                  <motion.div
                    initial={{ scale: 0.93, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="clay-panel p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-emerald-500/20 bg-emerald-500/5 shadow-md"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner border border-emerald-500/20">
                        <Award className="h-9 w-9 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-foreground">Quiz Graded!</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                          You scored {submissionResult.score} correct out of {submissionResult.total_questions} questions.
                        </p>
                      </div>
                    </div>
                    
                    {/* Score Circle */}
                    <div className="relative h-20 w-20 flex items-center justify-center rounded-full bg-card shadow-lg shadow-indigo-500/10 border border-border/50 shrink-0">
                      <span className="font-black text-sm text-primary">
                        {Math.round((submissionResult.score / submissionResult.total_questions) * 100)}%
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Question List */}
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-6"
                >
                  {activeQuiz.questions.map((q, idx) => {
                    const result = submissionResult?.results[q.id];
                    const selected = selectedAnswers[q.id];

                    return (
                      <motion.div
                        key={q.id}
                        variants={itemVariants}
                        className={`clay-card p-5 border-l-4 transition-all bg-card/75 shadow-sm ${
                          submissionResult
                            ? result?.is_correct
                              ? "border-l-emerald-500 bg-emerald-500/5"
                              : "border-l-red-500 bg-red-500/5"
                            : selected
                            ? "border-l-primary"
                            : "border-l-transparent"
                        }`}
                      >
                        <h4 className="font-extrabold text-xs mb-3 text-foreground">
                          Question {idx + 1}: {q.question_text}
                        </h4>

                        {/* Choices */}
                        <div className="grid grid-cols-1 gap-2.5">
                          {q.choices.map((choice) => {
                            const isSelected = selected === choice;
                            const isCorrect = choice === result?.correct_answer;
                            const isIncorrectUserChoice = isSelected && !result?.is_correct && submissionResult;

                            return (
                              <motion.button
                                key={choice}
                                whileHover={!submissionResult ? { scale: 1.01, x: 2 } : {}}
                                whileTap={!submissionResult ? { scale: 0.99 } : {}}
                                disabled={!!submissionResult}
                                onClick={() => handleAnswerSelect(q.id, choice)}
                                className={`text-left p-3.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                                  submissionResult
                                    ? isCorrect
                                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold"
                                      : isIncorrectUserChoice
                                      ? "bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400 font-extrabold"
                                      : "bg-muted/10 border-border/40 text-muted-foreground opacity-60"
                                    : isSelected
                                    ? "bg-primary/10 border-primary text-primary shadow-inner"
                                    : "bg-card hover:bg-muted/40 border-border/50 text-foreground"
                                }`}
                              >
                                <span>{choice}</span>
                                {submissionResult && isCorrect && <Check className="h-4.5 w-4.5 text-emerald-500 shrink-0" />}
                                {submissionResult && isIncorrectUserChoice && <X className="h-4.5 w-4.5 text-red-500 shrink-0" />}
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* Question feedback details */}
                        {submissionResult && result && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="mt-4 pt-3.5 border-t border-border/20 text-xs leading-relaxed"
                          >
                            <p className="font-extrabold text-rose">Explanation:</p>
                            <p className="text-muted-foreground mt-1 whitespace-pre-wrap font-medium">{result.explanation}</p>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>

              {/* Footer submission controls */}
              <div className="p-4 border-t border-border/40 bg-card/30 flex justify-between items-center shrink-0">
                {submissionResult ? (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveQuiz(null)}
                      className="px-4 py-2.5 text-xs font-bold clay-btn bg-card/50"
                    >
                      Back to Quizzes
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRetakeQuiz}
                      className="px-4 py-2.5 text-xs font-bold clay-btn-primary"
                    >
                      Retake Quiz
                    </motion.button>
                  </>
                ) : (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRetakeQuiz}
                      className="px-4 py-2.5 text-xs font-bold clay-btn bg-card/50 text-muted-foreground hover:text-foreground"
                    >
                      Reset Form
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmitQuiz}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 text-xs font-bold clay-btn-primary flex items-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" /> Grade Answers
                        </>
                      )}
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
