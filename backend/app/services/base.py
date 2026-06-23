from sqlalchemy.ext.asyncio import AsyncSession


class BaseService:
    """Base class for all business logic services.

    Provides transaction context helpers to commit or roll back database changes
    within service operations.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def commit(self) -> None:
        """Commit the current database transaction changes."""
        await self.db.commit()

    async def rollback(self) -> None:
        """Roll back the current database transaction changes."""
        await self.db.rollback()

    async def flush(self) -> None:
        """Flush pending changes to the database to populate generated columns/IDs

        without committing the transaction.
        """
        await self.db.flush()
