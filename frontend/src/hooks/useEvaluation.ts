import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useWorkspaceStore } from "@/store/workspace-store";

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
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  return useQuery({
    queryKey: ["evaluation", "quality", activeWorkspaceId],
    queryFn: async () => {
      const res = await apiClient.get("/evaluation/latest/quality");
      return res.data;
    },
    enabled: !!activeWorkspaceId,
  });
};

export const useEvaluationLatest = () => {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  return useQuery({
    queryKey: ["evaluation", "latest", activeWorkspaceId],
    queryFn: async () => {
      const res = await apiClient.get("/evaluation/latest");
      return res.data;
    },
    enabled: !!activeWorkspaceId,
  });
};

export const useEvaluationTrends = (mode?: string) => {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  return useQuery({
    queryKey: ["evaluation", "trends", activeWorkspaceId, mode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mode) params.append("mode", mode);
      if (activeWorkspaceId) params.append("workspace_id", activeWorkspaceId);
      const res = await apiClient.get(`/evaluation/trends?${params.toString()}`);
      return res.data;
    },
    enabled: !!activeWorkspaceId,
  });
};

export const useEvaluationFailures = (mode?: string) => {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  return useQuery({
    queryKey: ["evaluation", "failures", activeWorkspaceId, mode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mode) params.append("mode", mode);
      if (activeWorkspaceId) params.append("workspace_id", activeWorkspaceId);
      const res = await apiClient.get(`/evaluation/failures?${params.toString()}`);
      return res.data;
    },
    enabled: !!activeWorkspaceId,
  });
};

export const useEvaluationQuestions = (
  page: number = 1,
  size: number = 20,
  failureType?: string,
  mode?: string
) => {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  return useQuery({
    queryKey: ["evaluation", "questions", activeWorkspaceId, page, size, failureType, mode],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });
      if (mode) params.append("mode", mode);
      if (failureType) params.append("failure_type", failureType);
      if (activeWorkspaceId) params.append("workspace_id", activeWorkspaceId);
      
      const res = await apiClient.get(`/evaluation/questions?${params.toString()}`);
      return res.data;
    },
    enabled: !!activeWorkspaceId,
  });
};
