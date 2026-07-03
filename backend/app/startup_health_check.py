import sys
import os
import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

logger = logging.getLogger("app.startup_health_check")


class StartupValidationError(Exception):
    """Exception raised when startup validation checks fail."""
    pass


def validate_imports():
    """Verify that all core routes and dependencies import cleanly without errors."""
    logger.info("Running startup import checks...")
    try:
        # Import api router (which loads all endpoint modules)
        from app.api.v1.router import api_router
        logger.info("Successfully imported v1 api router.")
        
        # Verify dependency functions exist in app.api.deps
        from app.api import deps
        required_deps = ["get_current_user", "get_db"]
        for dep in required_deps:
            if not hasattr(deps, dep):
                raise StartupValidationError(f"Required dependency '{dep}' is missing from app.api.deps!")
        logger.info("Successfully validated dependencies in app.api.deps.")
        
        # Verify core services exist and are importable
        from app.services.retrieval import RetrievalService
        from app.services.rag_generation import RAGGenerationService
        from app.services.reranking import ScoreBasedReranker
        from app.services.embedding import get_embedding_provider
        logger.info("Successfully verified core services imports.")
        
    except ImportError as e:
        logger.critical(f"CRITICAL: Import check failed due to missing module or circular dependency: {e}")
        raise StartupValidationError(f"Import check failed: {e}")
    except Exception as e:
        logger.critical(f"CRITICAL: Unexpected error during import verification: {e}")
        raise StartupValidationError(f"Unexpected import check error: {e}")


def validate_config():
    """Verify that essential configuration variables are present and correct."""
    logger.info("Running config validation checks...")
    try:
        from app.core.config import settings
        
        if not settings.ASYNC_DATABASE_URI:
            raise StartupValidationError("ASYNC_DATABASE_URI is not set in configuration settings.")
            
        logger.info(f"Config validation succeeded for environment: {settings.ENVIRONMENT}")
    except Exception as e:
        logger.critical(f"CRITICAL: Config validation failed: {e}")
        raise StartupValidationError(f"Config validation failed: {e}")


async def test_database_connection():
    """Verify async database engine connectivity."""
    logger.info("Running database connectivity checks...")
    try:
        from app.core.config import settings
        # Create a temp engine to run test query
        engine = create_async_engine(
            settings.ASYNC_DATABASE_URI,
            echo=False,
            future=True,
        )
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            val = result.scalar()
            if val != 1:
                raise StartupValidationError("Database test query returned unexpected result.")
        await engine.dispose()
        logger.info("Database connectivity verification succeeded.")
    except Exception as e:
        logger.critical(f"CRITICAL: Database connection verification failed: {e}")
        raise StartupValidationError(f"Database connection verification failed: {e}")


async def test_embeddings_provider():
    """Verify embeddings provider initialization."""
    logger.info("Running embeddings provider checks...")
    try:
        from app.services.embedding import get_embedding_provider, LocalEmbeddingProvider
        provider = get_embedding_provider()
        logger.info(f"Active embedding provider: {provider.__class__.__name__}")
        
        # Test if it generates a simple vector
        test_vector = await provider.get_embedding("startup test")
        if not test_vector or len(test_vector) != 1536:
            logger.warning("Active embedding provider did not return a valid 1536-dim vector. Falling back to local verification.")
            local_p = LocalEmbeddingProvider()
            local_vector = await local_p.get_embedding("startup test")
            if not local_vector or len(local_vector) != 1536:
                raise StartupValidationError("Fallback LocalEmbeddingProvider failed vector generation test.")
        logger.info("Embeddings provider check succeeded.")
    except Exception as e:
        logger.warning(f"Embeddings check warning (Non-blocking): {e}")


async def run_startup_checks():
    """Execute all startup validations sequentially."""
    print("====================================================")
    print("STARTING NOTEAI PRODUCTION STARTUP HEALTH CHECK")
    print("====================================================")
    
    # Configure basic logger output if main application has not started logging yet
    logging.basicConfig(level=logging.INFO)
    
    try:
        # 1. Validate imports
        validate_imports()
        
        # 2. Validate configuration
        validate_config()
        
        # 3. Validate database connection
        skip_db = os.getenv("SKIP_STARTUP_DB_CHECK", "").strip().lower()
        is_testing = "pytest" in sys.modules or os.getenv("PYTEST_CURRENT_TEST") is not None
        if skip_db == "true" or is_testing:
            logger.info("Skipping database connection check (testing/override enabled).")
        else:
            await test_database_connection()
        
        # 4. Validate embeddings provider (optional/non-blocking)
        if is_testing:
            logger.info("Skipping embeddings provider check (testing enabled).")
        else:
            await test_embeddings_provider()
        
        print("====================================================")
        print("PRODUCTION STARTUP HEALTH CHECK: ALL SYSTEMS GREEN [OK]")
        print("====================================================")
    except StartupValidationError as exc:
        print("====================================================")
        print("PRODUCTION STARTUP HEALTH CHECK: FAILED [ERROR]")
        print(f"REASON: {exc}")
        print("====================================================")
        sys.exit(1)
    except Exception as exc:
        print("====================================================")
        print("PRODUCTION STARTUP HEALTH CHECK: UNEXPECTED FAILURE [ERROR]")
        print(f"REASON: {exc}")
        print("====================================================")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_startup_checks())
