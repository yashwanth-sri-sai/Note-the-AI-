import uuid
from datetime import datetime
from typing import List
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.db.models.note import note_tags


class Tag(Base):
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(
        String(7), default="#3B82F6", nullable=False
    )  # Hex color code
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship(back_populates="tags")
    notes: Mapped[List["Note"]] = relationship(
        secondary=note_tags, back_populates="tags"
    )

    # Constraints (Unique tag names per workspace)
    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_workspace_tag"),
    )
