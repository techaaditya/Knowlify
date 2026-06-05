import os
from datetime import datetime, timezone
from typing import Callable, Optional
from sqlalchemy.orm import Session

from ...models.source import Source, SourceChunk, ProcessingLog
from ...models.workspace import Workspace
from ..context.topic_extractor import extract_topics
from ..context.embedder import embed_texts
from .chunker import chunk_text
from .graph_integration import topics_to_graph, graph_to_storage, merge_workspace_graph
from .ai_enhancements import generate_ai_insights
from .processors import PROCESSOR_MAP

STAGES = [
    ("uploading", 5),
    ("extracting", 20),
    ("cleaning", 30),
    ("chunking", 45),
    ("entity_extraction", 60),
    ("relationship_discovery", 75),
    ("graph_construction", 90),
    ("ready", 100),
]


class IngestionPipeline:
    def __init__(self, db: Session, on_progress: Optional[Callable] = None):
        self.db = db
        self.on_progress = on_progress

    def _log(self, source: Source, stage: str, status: str, message: str = ""):
        log = ProcessingLog(
            source_id=source.id,
            stage=stage,
            status=status,
            message=message,
        )
        self.db.add(log)
        self.db.commit()

    def _update_stage(self, source: Source, stage: str, progress: int):
        source.processing_stage = stage
        source.progress_percent = progress
        source.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        if self.on_progress:
            self.on_progress(source.id, stage, progress)

    def process_source(self, source: Source, processor_type: str, **processor_kwargs):
        source.processing_status = "processing"
        self.db.commit()

        try:
            self._log(source, "uploading", "started", "Source received")
            self._update_stage(source, "uploading", 5)

            processor_cls = PROCESSOR_MAP.get(processor_type)
            if not processor_cls:
                raise ValueError(f"Unknown processor type: {processor_type}")

            processor = processor_cls()
            self._log(source, "extracting", "started")
            self._update_stage(source, "extracting", 20)
            result = processor.process(**processor_kwargs)

            self._log(source, "cleaning", "completed", f"Extracted {len(result.text)} characters")
            self._update_stage(source, "cleaning", 30)
            source.extracted_text = result.text
            if result.title and source.source_name == source.original_location:
                source.source_name = result.title
            source.metadata_json = {**(source.metadata_json or {}), **result.metadata}

            self._log(source, "chunking", "started")
            self._update_stage(source, "chunking", 45)
            chunks = chunk_text(result.text, source.id[:8])
            for old_chunk in source.chunks:
                self.db.delete(old_chunk)
            for chunk_data in chunks:
                chunk = SourceChunk(
                    source_id=source.id,
                    chunk_index=chunk_data["chunk_index"],
                    text=chunk_data["text"],
                    page_number=chunk_data.get("page"),
                    char_count=chunk_data["char_count"],
                )
                self.db.add(chunk)
            source.chunk_count = len(chunks)
            self.db.commit()

            chunk_dicts = [
                {"chunk_id": f"chunk_{c.chunk_index}", "page": c.page_number, "text": c.text, "char_count": c.char_count}
                for c in source.chunks
            ]

            self._log(source, "entity_extraction", "started")
            self._update_stage(source, "entity_extraction", 60)
            topic_data = extract_topics(chunk_dicts)
            topics_list = topic_data.get("topics", [])

            texts_to_embed = [t.get("description", "") for t in topics_list if t.get("description")]
            if texts_to_embed:
                try:
                    embed_texts(texts_to_embed)
                except Exception:
                    pass

            self._log(source, "relationship_discovery", "started")
            self._update_stage(source, "relationship_discovery", 75)
            G = topics_to_graph(topics_list)
            graph_data = graph_to_storage(topics_list, G)

            self._log(source, "graph_construction", "started")
            self._update_stage(source, "graph_construction", 90)
            source.entity_count = graph_data["entity_count"]
            source.relationship_count = graph_data["relationship_count"]
            source.metadata_json = {
                **(source.metadata_json or {}),
                "graph": {"nodes": graph_data["nodes"], "edges": graph_data["edges"]},
            }

            insights = generate_ai_insights(result.text, topics_list, graph_data.get("entities", []))
            source.ai_summary = insights["ai_summary"]
            source.key_topics = insights["key_topics"]
            source.extracted_entities = insights["extracted_entities"]
            source.relationship_insights = insights["relationship_insights"]
            source.suggested_questions = insights["suggested_questions"]

            self._merge_workspace_graph(source.workspace_id, graph_data)
            self._update_workspace_stats(source.workspace_id)

            source.processing_status = "completed"
            self._update_stage(source, "ready", 100)
            self._log(source, "ready", "completed", "Knowledge graph updated")
            self.db.commit()

        except Exception as e:
            source.processing_status = "failed"
            source.error_message = str(e)
            source.processing_stage = "failed"
            self._log(source, source.processing_stage or "error", "failed", str(e))
            self.db.commit()

    def _merge_workspace_graph(self, workspace_id: str, new_graph: dict):
        workspace = self.db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            return
        existing = (workspace.description or "")
        import json
        try:
            graph_store = json.loads(existing) if existing.startswith("{") else {}
        except json.JSONDecodeError:
            graph_store = {}
        merged = merge_workspace_graph(graph_store.get("graph"), new_graph)
        graph_store["graph"] = merged
        workspace.description = json.dumps(graph_store)

    def _update_workspace_stats(self, workspace_id: str):
        workspace = self.db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            return
        sources = self.db.query(Source).filter(Source.workspace_id == workspace_id).all()
        workspace.total_sources = len(sources)
        workspace.total_chunks = sum(s.chunk_count for s in sources)
        workspace.total_entities = sum(s.entity_count for s in sources)
        workspace.total_relationships = sum(s.relationship_count for s in sources)
        workspace.updated_at = datetime.now(timezone.utc)
        self.db.commit()
