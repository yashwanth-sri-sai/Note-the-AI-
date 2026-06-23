import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { Note } from "@/types";
import { 
  Sparkles, Check, HelpCircle, Loader2, Award, 
  ChevronRight, BookOpen, AlertCircle, RefreshCw, X, CheckSquare
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

export const QuizzesPage: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);

  // Loading states
  const [notesLoading, setNotesLoading] = useState(false);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load notes on mount / workspace change
  useEffect(() => {
    const fetchNotes = async () => {
      setNotesLoading(true);
      try {
        const response = await apiClient.get("/notes/");
        setNotes(response.data);
        setSelectedNoteId(null);
        setQuizzes([]);
        setActiveQuiz(null);
        setSubmissionResult(null);
      } catch (err) {
        console.error("Error fetching notes for quizzes:", err);
      } finally {
        setNotesLoading(false);
      }
    };

    if (activeWorkspaceId) {
      fetchNotes();
    }
  }, [activeWorkspaceId]);

  // Load quizzes for selected note
  const fetchQuizzes = async (noteId: string) => {
    setQuizzesLoading(true);
    try {
      const response = await apiClient.get(`/ai/notes/${noteId}/quizzes`);
      setQuizzes(response.data);
      setActiveQuiz(null);
      setSubmissionResult(null);
      setSelectedAnswers({});
    } catch (err) {
      console.error("Error loading quizzes:", err);
    } finally {
      setQuizzesLoading(false);
    }
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    fetchQuizzes(noteId);
  };

  const handleGenerateQuiz = async () => {
    if (!selectedNoteId) return;
    setIsGenerating(true);
    try {
      const response = await apiClient.post(`/ai/notes/${selectedNoteId}/quizzes/generate`);
      const newQuiz = response.data;
      setQuizzes((prev) => [newQuiz, ...prev]);
      setActiveQuiz(newQuiz);
      setSelectedAnswers({});
      setSubmissionResult(null);
    } catch (err) {
      alert("Failed to generate quiz. Check that the note has sufficient text context.");
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

    // Check that all questions are answered
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

  const activeNote = notes.find((n) => n.id === selectedNoteId);

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Left Column: Note list selector */}
      <div className="md:col-span-1 flex flex-col h-full overflow-hidden clay-panel bg-card/10">
        <div className="p-4 border-b border-border/40 shrink-0">
          <h3 className="font-bold text-xs uppercase text-muted-foreground/80 tracking-wider">
            Select Notebook Note
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Choose a note to test your knowledge.
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

      {/* Right Column: Quiz Workspace */}
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
              <CheckSquare className="h-10 w-10 text-muted-foreground/50 animate-pulse" />
              <h3 className="font-bold text-sm">No notebook chosen</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Select a note from the side panel to generate evaluation quizzes or load previous tests.
              </p>
            </motion.div>
          ) : quizzesLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex items-center justify-center clay-panel h-full"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                  <h3 className="font-bold text-sm">Quizzes for: {activeNote?.title}</h3>
                  <p className="text-[10px] text-muted-foreground">Select a quiz below or generate a new one.</p>
                </div>
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold clay-btn-primary disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Generate Quiz
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-3 scrollbar text-left">
                {quizzes.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <HelpCircle className="h-8 w-8 text-muted-foreground/45 mx-auto" />
                    <p className="text-xs text-muted-foreground">No quizzes generated for this note yet.</p>
                  </div>
                ) : (
                  quizzes.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setActiveQuiz(q)}
                      className="clay-card p-4 flex justify-between items-center cursor-pointer hover:border-primary/40 bg-card/60"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-foreground">{q.title}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {q.questions.length} Questions • Generated on {new Date(q.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
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
                  <h3 className="font-extrabold text-sm truncate">{activeQuiz.title}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    Notebook Note: {activeNote?.title}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveQuiz(null);
                    setSubmissionResult(null);
                  }}
                  className="p-1.5 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground clay-btn"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Quiz Body */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar text-left">
                {/* Result Summary (shown post-submission) */}
                {submissionResult && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="clay-panel p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-emerald-500/20 bg-emerald-500/5"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner border border-emerald-500/20">
                        <Award className="h-9 w-9 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-foreground">Quiz Graded!</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          You scored {submissionResult.score} correct out of {submissionResult.total_questions} questions.
                        </p>
                      </div>
                    </div>
                    
                    {/* Score Circle */}
                    <div className="relative h-20 w-20 flex items-center justify-center rounded-full bg-card shadow shadow-indigo-500/10 border border-border/50 shrink-0">
                      <span className="font-black text-sm text-primary">
                        {Math.round((submissionResult.score / submissionResult.total_questions) * 100)}%
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Question List */}
                <div className="space-y-6">
                  {activeQuiz.questions.map((q, idx) => {
                    const result = submissionResult?.results[q.id];
                    const selected = selectedAnswers[q.id];

                    return (
                      <div
                        key={q.id}
                        className={`clay-card p-5 border-l-4 transition-all bg-card/75 ${
                          submissionResult
                            ? result?.is_correct
                              ? "border-l-emerald-500 bg-emerald-500/5"
                              : "border-l-red-500 bg-red-500/5"
                            : selected
                            ? "border-l-primary"
                            : "border-l-transparent"
                        }`}
                      >
                        <h4 className="font-bold text-xs mb-3">
                          Question {idx + 1}: {q.question_text}
                        </h4>

                        {/* Choices */}
                        <div className="grid grid-cols-1 gap-2">
                          {q.choices.map((choice) => {
                            const isSelected = selected === choice;
                            const isCorrect = choice === result?.correct_answer;
                            const isIncorrectUserChoice = isSelected && !result?.is_correct && submissionResult;

                            return (
                              <button
                                key={choice}
                                disabled={!!submissionResult}
                                onClick={() => handleAnswerSelect(q.id, choice)}
                                className={`text-left p-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
                                  submissionResult
                                    ? isCorrect
                                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                                      : isIncorrectUserChoice
                                      ? "bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400 font-bold"
                                      : "bg-muted/10 border-border/40 text-muted-foreground opacity-60"
                                    : isSelected
                                    ? "bg-primary/10 border-primary text-primary shadow-inner"
                                    : "bg-card hover:bg-muted/40 border-border/50 text-foreground"
                                }`}
                              >
                                <span>{choice}</span>
                                {submissionResult && isCorrect && <Check className="h-4.5 w-4.5 text-emerald-500 shrink-0" />}
                                {submissionResult && isIncorrectUserChoice && <X className="h-4.5 w-4.5 text-red-500 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Question feedback details */}
                        {submissionResult && result && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="mt-4 pt-3 border-t border-border/20 text-xs leading-relaxed"
                          >
                            <p className="font-bold text-indigo-500">Explanation:</p>
                            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{result.explanation}</p>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer submission controls */}
              <div className="p-4 border-t border-border/40 bg-card/30 flex justify-between items-center shrink-0">
                {submissionResult ? (
                  <>
                    <button
                      onClick={() => setActiveQuiz(null)}
                      className="px-4 py-2 text-xs font-semibold clay-btn bg-card/50"
                    >
                      Back to Quizzes
                    </button>
                    <button
                      onClick={handleRetakeQuiz}
                      className="px-4 py-2 text-xs font-semibold clay-btn-primary"
                    >
                      Retake Quiz
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleRetakeQuiz}
                      className="px-4 py-2 text-xs font-semibold clay-btn bg-card/50 text-muted-foreground hover:text-foreground"
                    >
                      Reset Form
                    </button>
                    <button
                      onClick={handleSubmitQuiz}
                      disabled={isSubmitting}
                      className="px-5 py-2 text-xs font-bold clay-btn-primary flex items-center gap-1.5"
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
                    </button>
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
