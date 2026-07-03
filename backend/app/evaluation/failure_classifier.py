from app.evaluation.models import QuestionEvaluation

class FailureClassifier:
    def classify(self, q: QuestionEvaluation) -> QuestionEvaluation:
        # If recall is perfect and answers look good, it's not a failure
        # But wait, what if it's already marked as passed?
        # The prompt says: "If expected chunk never retrieved -> RETRIEVAL_FAILURE" etc.
        # Let's check for failure conditions in priority order.
        
        failure_type = "NONE"
        failure_reason = ""
        
        # Helper to check if any expected item is missing
        missing_chunks = [c for c in q.expected_chunk_ids if c not in q.retrieved_chunk_ids]
        missing_pages = [p for p in q.expected_pages if p not in q.retrieved_pages]
        
        if missing_chunks or missing_pages or q.retrieval_recall < 1.0:
            # We have some retrieval/rerank/chunking issue
            
            # Rule 1: If expected chunk never retrieved -> RETRIEVAL_FAILURE
            # If the missing chunks were also NOT in pre_rerank_chunk_ids (the raw DB output)
            if any(c not in q.pre_rerank_chunk_ids for c in missing_chunks):
                failure_type = "RETRIEVAL_FAILURE"
                failure_reason = f"Expected chunk(s) {missing_chunks} were never retrieved from vector DB."
                
            # Rule 2: If expected chunk retrieved but outside Top-K -> RERANK_FAILURE
            elif any(c in q.pre_rerank_chunk_ids for c in missing_chunks):
                failure_type = "RERANK_FAILURE"
                failure_reason = f"Expected chunk(s) {missing_chunks} were retrieved from DB but excluded by reranker."
                
            # Rule 3: If expected page retrieved but answer split across chunks -> CHUNKING_FAILURE
            # (i.e. pages matched, but recall was < 1 or specific chunks missed)
            elif not missing_pages and missing_chunks:
                failure_type = "CHUNKING_FAILURE"
                failure_reason = f"Expected page(s) {q.expected_pages} were retrieved, but exact chunks were missed or answer was split across boundaries."
            
            # Fallback for page-level retrieval failures
            elif missing_pages:
                failure_type = "RETRIEVAL_FAILURE"
                failure_reason = f"Expected page(s) {missing_pages} were never retrieved."
                
        # Rule 5: If answer contains unsupported facts -> HALLUCINATION
        # Check hallucination rate or groundedness
        elif q.hallucination_score > 0.0 or q.groundedness < 0.8:
            failure_type = "HALLUCINATION"
            failure_reason = f"Answer contains unsupported facts (Hallucination score: {q.hallucination_score:.2f}, Groundedness: {q.groundedness:.2f})."
            
        # Rule 6: If answer cites wrong document/page -> CITATION_FAILURE
        elif q.citation_accuracy < 1.0:
            failure_type = "CITATION_FAILURE"
            failure_reason = f"Answer cited incorrect documents. Expected: {q.expected_documents}, Retrieved/Used: {q.retrieved_documents}."
            
        # Rule 4: If retrieved context contains answer but LLM missed it -> PROMPT_FAILURE
        # If no chunks missing, but faithfulness or relevancy is poor despite perfect retrieval
        elif q.faithfulness < 0.8:
            failure_type = "PROMPT_FAILURE"
            failure_reason = "Retrieved context contained the answer, but the LLM failed to use it properly or ignored it."

        # If it failed some other vague threshold but none of the above caught it
        # E.g. expected everything perfectly but still marked as failure externally?
        # For now, we only assign UNKNOWN if we explicitly detect a failure we can't classify
        # Wait, if all metrics are perfect, failure_type remains "NONE".
        
        q.failure_type = failure_type
        q.failure_reason = failure_reason
        return q
