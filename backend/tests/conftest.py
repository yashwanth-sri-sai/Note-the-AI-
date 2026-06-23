import asyncio
from typing import AsyncGenerator, Generator
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Override database URI configuration for testing
from app.core.config import settings
TEST_DATABASE_URL = settings.ASYNC_DATABASE_URI.replace(
    f"/{settings.POSTGRES_DB}", f"/{settings.POSTGRES_DB}_test"
)

# Create an async engine for testing using NullPool to prevent pooled connection locks
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,
    future=True,
)

test_async_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

from app.db.session import Base, get_db
from app.main import app


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Session-scoped fixture to automatically create all tables on session start

    and drop them when the test session completes.
    """
    async with test_engine.begin() as conn:
        # Enable vector and pg_trgm extensions inside the test db first
        await conn.execute(sa_text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.execute(sa_text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(sa_text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


# Small helper import to allow sa_text
from sqlalchemy import text as sa_text


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Function-scoped fixture providing a transaction-isolated database session.

    Wraps execution inside a transaction savepoint and rolls it back on completion,
    preventing test cases from leaking database modifications to each other.
    """
    connection = await test_engine.connect()
    transaction = await connection.begin()

    # Create a session bound to this connection
    async_session = AsyncSession(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    yield async_session

    await async_session.close()
    await transaction.rollback()
    await connection.close()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Returns an async HTTP client configured with overridden dependencies

    yielding our transaction-isolated database session.
    """
    # Override database dependency mapping
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://testserver") as async_client:
        yield async_client

    # Clean overrides
    app.dependency_overrides.clear()
