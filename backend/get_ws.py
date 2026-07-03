import asyncio
from app.db.session import async_session_factory
from app.db.models.workspace import Workspace
from sqlalchemy import select

async def get_ws():
    async with async_session_factory() as db:
        res = await db.execute(select(Workspace.id))
        print(res.scalars().first())

asyncio.run(get_ws())
