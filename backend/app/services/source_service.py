import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import UploadFile

from ..models.source import Source
from ..models.workspace import Workspace
from ..engines.ingestion.validators import (
    validate_upload_batch,
    validate_file,
    ValidationError,
)
from ..engines.ingestion.pipeline import IngestionPipeline

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


def ensure_upload_dir(workspace_id: str) -> str:
    path = os.path.join(UPLOAD_DIR, workspace_id)
    os.makedirs(path, exist_ok=True)
    return path


def get_or_create_default_workspace(db: Session, user_id: str | None = None) -> Workspace:
    """Return a usable workspace, scoped to the user when one is provided."""
    if user_id is not None:
        return ensure_user_workspaces(db, user_id)[0]
    workspace = db.query(Workspace).first()
    if not workspace:
        workspace = Workspace(name="My Knowledge Base", description="{}")
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
    return workspace


def ensure_user_workspaces(db: Session, user_id: str) -> list[Workspace]:
    """Return the user's workspaces, creating/claiming as needed.

    Isolation rules:
      1. If the user already owns workspaces, return them.
      2. Otherwise, the first authenticated user adopts any legacy unowned
         workspaces (the pre-auth shared data), so existing uploads aren't lost.
      3. If nothing is left to adopt, create a fresh empty workspace.
    """
    owned = (
        db.query(Workspace)
        .filter(Workspace.user_id == user_id)
        .order_by(Workspace.updated_at.desc())
        .all()
    )
    if owned:
        return owned

    unowned = db.query(Workspace).filter(Workspace.user_id.is_(None)).all()
    if unowned:
        for ws in unowned:
            ws.user_id = user_id
        db.commit()
        return (
            db.query(Workspace)
            .filter(Workspace.user_id == user_id)
            .order_by(Workspace.updated_at.desc())
            .all()
        )

    workspace = Workspace(name="My Knowledge Base", description="{}", user_id=user_id)
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return [workspace]


def workspace_owned_by(db: Session, workspace_id: str, user_id: str) -> Optional[Workspace]:
    """Return the workspace only if it belongs to the given user."""
    return (
        db.query(Workspace)
        .filter(Workspace.id == workspace_id, Workspace.user_id == user_id)
        .first()
    )


def get_workspace(db: Session, workspace_id: str) -> Optional[Workspace]:
    return db.query(Workspace).filter(Workspace.id == workspace_id).first()


def create_source_record(
    db: Session,
    workspace_id: str,
    source_type: str,
    source_name: str,
    original_location: str = "",
    metadata: dict | None = None,
) -> Source:
    source = Source(
        workspace_id=workspace_id,
        source_type=source_type,
        source_name=source_name,
        original_location=original_location,
        processing_status="pending",
        metadata_json=metadata or {},
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


async def handle_file_uploads(
    db: Session,
    workspace_id: str,
    files: list[UploadFile],
) -> list[Source]:
    workspace = get_workspace(db, workspace_id)
    if not workspace:
        raise ValidationError("Workspace not found.")

    file_data: list[tuple[str, bytes]] = []
    for f in files:
        content = await f.read()
        file_data.append((f.filename or "unnamed", content))

    validate_upload_batch(file_data)
    upload_path = ensure_upload_dir(workspace_id)
    sources = []

    ext_to_type = {".pdf": "pdf", ".docx": "docx", ".pptx": "pptx", ".txt": "txt", ".md": "md"}

    for filename, content in file_data:
        ext = validate_file(filename, content)
        processor_type = ext_to_type[ext]
        safe_name = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(upload_path, safe_name)
        with open(filepath, "wb") as out:
            out.write(content)

        source = create_source_record(
            db,
            workspace_id,
            source_type=processor_type,
            source_name=filename,
            original_location=filepath,
            metadata={"filename": filename, "size_bytes": len(content)},
        )
        sources.append(source)

    return sources


def build_reprocess_kwargs(source: Source) -> dict:
    kwargs = {}
    if source.source_type in ("pdf", "docx", "pptx", "txt", "md"):
        kwargs = {"filename": source.source_name, "filepath": source.original_location}
        if source.original_location and os.path.exists(source.original_location):
            with open(source.original_location, "rb") as f:
                kwargs["content"] = f.read()
    elif source.source_type == "paste":
        content = source.extracted_text or (source.metadata_json or {}).get("draft_content", "")
        kwargs = {"title": source.source_name, "content": content}
    elif source.source_type == "website":
        kwargs = {"url": source.original_location}
    elif source.source_type == "youtube":
        kwargs = {"url": source.original_location}
    return kwargs


def create_paste_source(db: Session, workspace_id: str, title: str, content: str) -> Source:
    workspace = get_workspace(db, workspace_id)
    if not workspace:
        raise ValidationError("Workspace not found.")
    return create_source_record(
        db,
        workspace_id,
        source_type="paste",
        source_name=title,
        original_location="pasted://text",
        metadata={"char_count": len(content), "draft_content": content},
    )


def create_website_source(db: Session, workspace_id: str, url: str) -> Source:
    workspace = get_workspace(db, workspace_id)
    if not workspace:
        raise ValidationError("Workspace not found.")
    return create_source_record(
        db,
        workspace_id,
        source_type="website",
        source_name=url,
        original_location=url,
    )


def create_youtube_source(db: Session, workspace_id: str, url: str) -> Source:
    workspace = get_workspace(db, workspace_id)
    if not workspace:
        raise ValidationError("Workspace not found.")
    return create_source_record(
        db,
        workspace_id,
        source_type="youtube",
        source_name=url,
        original_location=url,
    )


def delete_source(db: Session, source_id: str) -> bool:
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        return False
    workspace_id = source.workspace_id
    if source.original_location and os.path.exists(source.original_location):
        try:
            os.remove(source.original_location)
        except OSError:
            pass
    db.delete(source)
    db.commit()
    pipeline = IngestionPipeline(db)
    pipeline._update_workspace_stats(workspace_id)
    return True
