from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ForbiddenException, NotFoundException
from app.db.models.note import Note, NoteVersion
from app.repositories.note import NoteRepository
from app.repositories.folder import FolderRepository
from app.repositories.tag import TagRepository
from app.schemas.note import NoteCreate, NoteUpdate


class NoteService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.note_repo = NoteRepository(db)
        self.folder_repo = FolderRepository(db)
        self.tag_repo = TagRepository(db)

    async def get_note(self, note_id: UUID, workspace_id: UUID) -> Note:
        """Fetch note by ID and verify workspace scoping, loading tags eagerly."""
        note = await self.note_repo.get_with_tags(note_id)
        if not note:
            raise NotFoundException(detail="Note not found")
        if note.workspace_id != workspace_id:
            raise ForbiddenException(detail="Access denied to note")
        return note

    async def get_workspace_notes(
        self,
        workspace_id: UUID,
        folder_id: Optional[UUID] = None,
        tag_id: Optional[UUID] = None,
        is_favorite: Optional[bool] = None,
    ) -> List[Note]:
        """Fetch all notes matching workspace and optional filters."""
        return await self.note_repo.get_workspace_notes(
            workspace_id=workspace_id,
            folder_id=folder_id,
            tag_id=tag_id,
            is_favorite=is_favorite,
        )

    async def create_note(self, workspace_id: UUID, user_id: UUID, note_in: NoteCreate) -> Note:
        """Create a new note, verifying folder scoping if specified."""
        if note_in.folder_id:
            folder = await self.folder_repo.get(note_in.folder_id)
            if not folder or folder.workspace_id != workspace_id:
                raise ForbiddenException(detail="Invalid folder ID specified")

        db_note = Note(
            title=note_in.title or "Untitled Note",
            content=note_in.content or "",
            folder_id=note_in.folder_id,
            workspace_id=workspace_id,
            created_by=user_id,
            is_favorite=note_in.is_favorite or False,
        )
        note = await self.note_repo.create(db_note)
        await self.db.flush()
        return await self.note_repo.get_with_tags(note.id)


    async def update_note(
        self, note_id: UUID, workspace_id: UUID, note_in: NoteUpdate, user_id: Optional[UUID] = None
    ) -> Note:
        """Update a note's text, title, folder, or favorite status."""
        note = await self.get_note(note_id, workspace_id)
        update_data = note_in.model_dump(exclude_unset=True)

        if "folder_id" in update_data and update_data["folder_id"]:
            folder = await self.folder_repo.get(update_data["folder_id"])
            if not folder or folder.workspace_id != workspace_id:
                raise ForbiddenException(detail="Invalid folder ID specified")

        # Create snapshot of current state BEFORE applying updates if there's content change
        content_changed = (
            ("content" in update_data and update_data["content"] != note.content) or
            ("title" in update_data and update_data["title"] != note.title)
        )
        if content_changed:
            await self.create_version_snapshot(note, user_id)

        # Update note model fields
        updated_note = await self.note_repo.update(note, update_data)
        # Flush to DB to ensure timestamps/changes are updated
        await self.db.flush()
        return updated_note

    async def delete_note(self, note_id: UUID, workspace_id: UUID) -> Note:
        """Delete a note."""
        note = await self.get_note(note_id, workspace_id)
        await self.note_repo.delete(note_id)
        return note

    async def duplicate_note(self, note_id: UUID, workspace_id: UUID, user_id: UUID) -> Note:
        """Duplicate an existing note along with its associated tags."""
        original = await self.get_note(note_id, workspace_id)

        duplicated = Note(
            title=f"Copy of {original.title}",
            content=original.content,
            folder_id=original.folder_id,
            workspace_id=workspace_id,
            created_by=user_id,
            is_favorite=original.is_favorite,
        )
        # Assign copies of relationship tags
        duplicated.tags = list(original.tags)

        # Create note record
        note = await self.note_repo.create(duplicated)
        await self.db.flush()
        return await self.note_repo.get_with_tags(note.id)


    async def set_note_tags(
        self, note_id: UUID, workspace_id: UUID, tag_ids: List[UUID]
    ) -> Note:
        """Attach a collection of tags to a note, clearing any previous tags."""
        note = await self.get_note(note_id, workspace_id)

        # Fetch and verify tags inside the workspace
        tags = await self.tag_repo.get_by_ids(workspace_id, tag_ids)
        if len(tags) != len(tag_ids):
            raise ForbiddenException(
                detail="One or more specified tag IDs are invalid or inaccessible."
            )

        # Reassign relationship
        note.tags = tags
        self.db.add(note)
        await self.db.flush()
        return note

    async def create_version_snapshot(self, note: Note, creator_id: Optional[UUID] = None) -> Optional[NoteVersion]:
        """Create a history snapshot of the note if it has meaningful changes."""
        from sqlalchemy import select, desc
        from datetime import datetime

        # Get latest version
        query = (
            select(NoteVersion)
            .where(NoteVersion.note_id == note.id)
            .order_by(desc(NoteVersion.version_number))
            .limit(1)
        )
        result = await self.db.execute(query)
        latest_ver = result.scalar_one_or_none()

        # Check if changes happened compared to latest snapshot
        if latest_ver:
            if latest_ver.title_snapshot == note.title and latest_ver.content_snapshot == note.content:
                return None

            # If within 5 minutes, overwrite the latest instead of creating a new entry
            elapsed = datetime.utcnow() - latest_ver.created_at.replace(tzinfo=None)
            if elapsed.total_seconds() < 300:
                latest_ver.title_snapshot = note.title
                latest_ver.content_snapshot = note.content
                latest_ver.created_at = datetime.utcnow()
                self.db.add(latest_ver)
                await self.db.flush()
                return latest_ver

            next_version = latest_ver.version_number + 1
        else:
            next_version = 1

        new_ver = NoteVersion(
            note_id=note.id,
            title_snapshot=note.title,
            content_snapshot=note.content,
            version_number=next_version,
            created_by=creator_id,
        )
        self.db.add(new_ver)
        await self.db.flush()
        return new_ver

    async def list_note_versions(self, note_id: UUID, workspace_id: UUID) -> List[NoteVersion]:
        """List all version snapshots of a note, ordered by version number descending."""
        from sqlalchemy import select, desc
        from app.db.models.note import NoteVersion

        # Verify note belongs to workspace
        await self.get_note(note_id, workspace_id)

        query = (
            select(NoteVersion)
            .where(NoteVersion.note_id == note_id)
            .order_by(desc(NoteVersion.version_number))
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def restore_note_version(self, note_id: UUID, version_id: UUID, workspace_id: UUID) -> Note:
        """Restore a note's state to a specific history snapshot."""
        from sqlalchemy import select
        from app.db.models.note import NoteVersion

        # Verify note belongs to workspace
        note = await self.get_note(note_id, workspace_id)

        # Get target version
        query = select(NoteVersion).where(
            NoteVersion.note_id == note_id,
            NoteVersion.id == version_id
        )
        result = await self.db.execute(query)
        version = result.scalar_one_or_none()
        if not version:
            raise NotFoundException(detail="Version snapshot not found")

        # Save snapshot of CURRENT state before restoring (so they don't lose current work)
        await self.create_version_snapshot(note)

        # Restore content
        note.title = version.title_snapshot
        note.content = version.content_snapshot
        self.db.add(note)
        await self.db.flush()
        return note
