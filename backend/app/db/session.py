from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, declared_attr
from app.core.config import settings

# Create database engine
engine = create_async_engine(
    settings.ASYNC_DATABASE_URI,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Create sessionmaker for async database transactions
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# Base model class for all SQLAlchemy entities
class Base(DeclarativeBase):
    @declared_attr
    def __tablename__(cls) -> str:
        # Convert CamelCase class name to snake_case table name
        name = cls.__name__
        parts = []
        start = 0
        for i in range(1, len(name)):
            if name[i].isupper() and not name[i - 1].isupper():
                parts.append(name[start:i].lower())
                start = i
        parts.append(name[start:].lower())
        return "_".join(parts) + "s"


# Async dependency injection tool for database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


import logging
from sqlalchemy.exc import DBAPIError, OperationalError

safe_db_logger = logging.getLogger("app.db.safe_execute")


async def safe_db_execute(session: AsyncSession, statement, *args, **kwargs):
    """Executes a SQL query/statement safely.
    
    - Wraps operations with rollback on exception
    - Retries once on transient OperationalError/DBAPIError
    """
    try:
        # First attempt
        result = await session.execute(statement, *args, **kwargs)
        return result
    except (OperationalError, DBAPIError) as e:
        safe_db_logger.warning(f"Transient database error caught: {e}. Retrying query...")
        try:
            await session.rollback()
        except Exception:
            pass
        try:
            # Second attempt (retry)
            result = await session.execute(statement, *args, **kwargs)
            return result
        except Exception as retry_exc:
            safe_db_logger.error(f"Retry query failed: {retry_exc}")
            try:
                await session.rollback()
            except Exception:
                pass
            raise
    except Exception as e:
        safe_db_logger.error(f"Database query error: {e}")
        try:
            await session.rollback()
        except Exception:
            pass
        raise

