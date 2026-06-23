class TokenService:
    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Heuristic character-to-token count estimator.
        
        Uses standard ~4 character-per-token ratio, guaranteeing at least 1 token.
        """
        if not text:
            return 0
        return max(1, len(text) // 4)
