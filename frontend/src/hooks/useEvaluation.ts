import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

export interface TrendPoint {
  timestamp: string;
  metric: string;
  value: number;
}

export interface QuestionEvaluation {
  question_id: string;
  question: string;
  expected_answer: string;
  generated_answer: string;
  expected_documents: string[];
  retrieved_documents: string[];
  expected_chunk_ids: string[];
  retrieved_chunk_ids: string[];
  expected_pages: number[];
  retrieved_pages: number[];
  latency_ms: number;
  retrieval_recall: number;
  retrieval_precision: number;
  groundedness: number;
  faithfulness: number;
  hallucination_score: number;
  citation_accuracy: number;
  failure_type: string;
  failure_reason: string;
  pre_rerank_chunk_ids: string[];
}

export const useEvaluationQuality = () => {
  const { currentWorkspace } = useAuthStore();
  return useQuery({
    queryKey: ["evaluation", "quality", currentWorkspace?.id],
    queryFn: async () => {
      const res = await apiClient.get("/evaluation/latest/quality");
      return res.data;
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useEvaluationLatest = () => {
  const { currentWorkspace } = useAuthStore();
  return useQuery({
    queryKey: ["evaluation", "latest", currentWorkspace?.id],
    queryFn: async () => {
      const res = await apiClient.get("/evaluation/latest");
      return res.data;
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useEvaluationTrends = (mode?: string) => {
  const { currentWorkspace } = useAuthStore();
  return useQuery({
    queryKey: ["evaluation", "trends", currentWorkspace?.id, mode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mode) params.append("mode", mode);
      if (currentWorkspace?.id) params.append("workspace_id", currentWorkspace.id);
      const res = await apiClient.get(`/evaluation/trends?${params.toString()}`);
      return res.data;
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useEvaluationFailures = (mode?: string) => {
  const { currentWorkspace } = useAuthStore();
  return useQuery({
    queryKey: ["evaluation", "failures", currentWorkspace?.id, mode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mode) params.append("mode", mode);
      if (currentWorkspace?.id) params.append("workspace_id", currentWorkspace.id);
      const res = await apiClient.get(`/evaluation/failures?${params.toString()}`);
      return res.data;
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useEvaluationQuestions = (
  page: number = 1,
  size: number = 20,
  failureType?: string,
  mode?: string
) => {
  const { currentWorkspace } = useAuthStore();
  return useQuery({
    queryKey: ["evaluation", "questions", currentWorkspace?.id, page, size, failureType, mode],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });
      if (mode) params.append("mode", mode);
      if (failureType) params.append("failure_type", failureType);
      if (currentWorkspace?.id) params.append("workspace_id", currentWorkspace.id);
      
      const res = await apiClient.get(`/evaluation/questions?${params.toString()}`);
      return res.data;
    },
    enabled: !!currentWorkspace?.id,
  });
};
