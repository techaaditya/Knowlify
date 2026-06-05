from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, BackgroundTasks
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.source import (
    SourceCreatePaste,
    SourceCreateWebsite,
    SourceCreateYouTube,
    SourceUpdate,
    SourceResponse,
    SourceDetailResponse,
    SourceStatusResponse,
    UploadResponse,
    ProcessingLogResponse,
)
from ..models.source import Source, ProcessingLog
from ..services import source_service
from ..services.background import run_source_processing
from ..engines.ingestion.validators import ValidationError, validate_youtube_url
from ..engines.ingestion.processors.youtube import YouTubeProcessor

router = APIRouter(prefix="/api/sources", tags=["sources"])


def _to_response(source: Source) -> SourceResponse:
    return SourceResponse.model_validate(source)


@router.post("/upload", response_model=UploadResponse)
async def upload_sources(
    background_tasks: BackgroundTasks,
    workspace_id: str = Form(...),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    try:
        sources = await source_service.handle_file_uploads(db, workspace_id, files)
        for source in sources:
            background_tasks.add_task(
                run_source_processing,
                source.id,
                source.source_type,
                filename=source.source_name,
                filepath=source.original_location,
            )
        return UploadResponse(
            sources=[_to_response(s) for s in sources],
            message=f"Uploading {len(sources)} source(s). Processing in background.",
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/paste", response_model=SourceResponse)
def paste_source(
    payload: SourceCreatePaste,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        source = source_service.create_paste_source(
            db, payload.workspace_id, payload.title, payload.content
        )
        background_tasks.add_task(
            run_source_processing,
            source.id,
            "paste",
            title=payload.title,
            content=payload.content,
        )
        return _to_response(source)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/website", response_model=SourceResponse)
def import_website(
    payload: SourceCreateWebsite,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        source = source_service.create_website_source(db, payload.workspace_id, payload.url)
        background_tasks.add_task(
            run_source_processing,
            source.id,
            "website",
            url=payload.url,
        )
        return _to_response(source)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/youtube/preview")
def preview_youtube(url: str = Query(...)):
    try:
        url = validate_youtube_url(url)
        processor = YouTubeProcessor()
        video_id = processor._extract_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL.")
        meta = processor._fetch_video_metadata(url, video_id)
        return {
            "video_id": video_id,
            "title": meta.get("title"),
            "channel": meta.get("author_name", ""),
            "thumbnail": meta.get("thumbnail_url"),
            "url": url,
        }
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/youtube", response_model=SourceResponse)
def import_youtube(
    payload: SourceCreateYouTube,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        source = source_service.create_youtube_source(db, payload.workspace_id, payload.url)
        background_tasks.add_task(
            run_source_processing,
            source.id,
            "youtube",
            url=payload.url,
        )
        return _to_response(source)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspace/{workspace_id}", response_model=list[SourceResponse])
def list_workspace_sources(
    workspace_id: str,
    search: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    sort: str = Query("newest"),
    db: Session = Depends(get_db),
):
    query = db.query(Source).filter(Source.workspace_id == workspace_id)

    if search:
        query = query.filter(Source.source_name.ilike(f"%{search}%"))
    if source_type:
        type_map = {
            "pdf": ["pdf"],
            "documents": ["pdf", "docx", "pptx", "txt", "md"],
            "websites": ["website"],
            "youtube": ["youtube"],
            "notes": ["paste"],
        }
        types = type_map.get(source_type, [source_type])
        query = query.filter(Source.source_type.in_(types))

    if sort == "oldest":
        query = query.order_by(Source.created_at.asc())
    elif sort == "largest":
        query = query.order_by(Source.chunk_count.desc())
    elif sort == "most_connected":
        query = query.order_by(Source.relationship_count.desc())
    else:
        query = query.order_by(Source.created_at.desc())

    sources = query.all()
    return [_to_response(s) for s in sources]


@router.get("/{source_id}", response_model=SourceDetailResponse)
def get_source(source_id: str, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")
    logs = (
        db.query(ProcessingLog)
        .filter(ProcessingLog.source_id == source_id)
        .order_by(ProcessingLog.created_at.asc())
        .all()
    )
    return SourceDetailResponse(
        **_to_response(source).model_dump(),
        extracted_text=source.extracted_text,
        processing_logs=[ProcessingLogResponse.model_validate(l) for l in logs],
        chunks=[
            {
                "id": c.id,
                "chunk_index": c.chunk_index,
                "text": c.text[:500] + ("..." if len(c.text) > 500 else ""),
                "page_number": c.page_number,
                "char_count": c.char_count,
            }
            for c in source.chunks
        ],
    )


@router.get("/{source_id}/status", response_model=SourceStatusResponse)
def get_source_status(source_id: str, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")
    logs = (
        db.query(ProcessingLog)
        .filter(ProcessingLog.source_id == source_id)
        .order_by(ProcessingLog.created_at.asc())
        .all()
    )
    return SourceStatusResponse(
        id=source.id,
        processing_status=source.processing_status,
        processing_stage=source.processing_stage,
        progress_percent=source.progress_percent,
        error_message=source.error_message,
        processing_logs=[ProcessingLogResponse.model_validate(l) for l in logs],
    )


@router.patch("/{source_id}", response_model=SourceResponse)
def update_source(source_id: str, payload: SourceUpdate, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")
    if payload.source_name:
        source.source_name = payload.source_name
    db.commit()
    db.refresh(source)
    return _to_response(source)


@router.post("/{source_id}/reprocess", response_model=SourceResponse)
def reprocess_source(
    source_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")

    source.processing_status = "pending"
    source.error_message = None
    source.progress_percent = 0
    db.commit()

    kwargs = source_service.build_reprocess_kwargs(source)
    background_tasks.add_task(
        run_source_processing,
        source.id,
        source.source_type,
        **kwargs,
    )
    db.refresh(source)
    return _to_response(source)


@router.delete("/{source_id}")
def delete_source(source_id: str, db: Session = Depends(get_db)):
    if not source_service.delete_source(db, source_id):
        raise HTTPException(status_code=404, detail="Source not found.")
    return {"message": "Source deleted successfully."}
