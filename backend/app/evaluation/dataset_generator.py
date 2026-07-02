import json
import uuid
import httpx
import random
from typing import List, Dict, Any
from sqlalchemy import select
from app.db.session import async_session_maker
from app.db.models.document import DocumentChunk, Document
from app.core.config import settings
from app.core.retries import retry_with_backoff

async def generate_dataset(workspace_id: uuid.UUID, num_samples: int = 10, output_file: str = "app/evaluation/test_cases.json"):
    """Generates a synthetic ground-truth dataset from random document chunks."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        print("GEMINI_API_KEY is required to generate datasets.")
        return
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    async with async_session_maker() as db:
        # Fetch a pool of chunks from the workspace
        stmt = (
            select(DocumentChunk, Document.filename)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.workspace_id == workspace_id)
            .limit(100)
        )
        res = await db.execute(stmt)
        rows = res.all()
        
    if not rows:
        print(f"No documents found for workspace {workspace_id}")
        return
        
    test_cases = []
    
    for i in range(num_samples):
        # Determine difficulty logic
        rand_val = random.random()
        if rand_val < 0.6:
            difficulty = "Easy"
            chunks = random.sample(rows, 1)
        elif rand_val < 0.8:
            difficulty = "Medium"
            # Try to get 2 chunks from same document (fallback to random if not possible easily here)
            chunks = random.sample(rows, min(2, len(rows)))
        elif rand_val < 0.95:
            difficulty = "Hard"
            # Two random chunks
            chunks = random.sample(rows, min(2, len(rows)))
        else:
            difficulty = "Adversarial"
            chunks = random.sample(rows, 1)

        context_text = "\n\n".join([c[0].chunk_text for c in chunks])
        source_uuids = [str(c[0].id) for c in chunks]
        source_names = list(set([c[1] for c in chunks]))
        source_pages = list(set([c[0].page_number for c in chunks if c[0].page_number]))
        
        if difficulty == "Adversarial":
            prompt = f"""
            Given the following text context, generate a question that sounds like it should be answered by the text, but the text ACTUALLY DOES NOT contain the answer.
            The expected_answer MUST be "I could not find sufficient information in the uploaded documents."
            
            Context: {context_text}
            
            Return STRICTLY a JSON object with keys: "question", "expected_answer". No markdown formatting.
            """
        else:
            prompt = f"""
            Given the following text context, generate a specific, factual question that can be perfectly answered using ONLY the context.
            Generate the expected answer.
            
            Context: {context_text}
            
            Return STRICTLY a JSON object with keys: "question", "expected_answer". No markdown formatting.
            """
            
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7 if difficulty == "Adversarial" else 0.2}
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await retry_with_backoff(client.post, url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                text_response = data["candidates"][0]["content"]["parts"][0]["text"]
                text_response = text_response.strip().replace("```json", "").replace("```", "")
                llm_output = json.loads(text_response)
                
                test_cases.append({
                    "id": f"tc-{uuid.uuid4()}",
                    "question": llm_output["question"],
                    "expected_answer": llm_output["expected_answer"],
                    "expected_citations": source_names,
                    "relevant_pages": source_pages,
                    "expected_chunk_uuids": source_uuids if difficulty != "Adversarial" else [],
                    "difficulty": difficulty
                })
                print(f"Generated {difficulty} case: {llm_output['question']}")
        except Exception as e:
            print(f"Failed to generate case {i}: {e}")
            
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(test_cases, f, indent=2)
        
    print(f"Successfully generated {len(test_cases)} test cases in {output_file}")

if __name__ == "__main__":
    import asyncio
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m app.evaluation.dataset_generator <workspace_id> [num_samples]")
        sys.exit(1)
    workspace_id = uuid.UUID(sys.argv[1])
    num_samples = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    asyncio.run(generate_dataset(workspace_id, num_samples))
