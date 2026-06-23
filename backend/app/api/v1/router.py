from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, folders, notes, tags, workspaces, ai, documents, chat, metrics, admin_metrics

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(folders.router, prefix="/folders", tags=["Folders"])
api_router.include_router(notes.router, prefix="/notes", tags=["Notes"])
api_router.include_router(tags.router, prefix="/tags", tags=["Tags"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI & Extensions"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["Telemetry & Dashboards"])
api_router.include_router(admin_metrics.router, prefix="/admin/metrics", tags=["Admin Telemetry"])

