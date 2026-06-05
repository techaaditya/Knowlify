from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..engines.ingestion.pipeline import IngestionPipeline


def run_source_processing(source_id: str, processor_type: str, **processor_kwargs):
    db: Session = SessionLocal()
    try:
        from ..models.source import Source

        source = db.query(Source).filter(Source.id == source_id).first()
        if not source:
            return
        pipeline = IngestionPipeline(db)
        pipeline.process_source(source, processor_type, **processor_kwargs)
    except Exception as e:
        print(f"[ingestion] Source {source_id} failed: {e}")
    finally:
        db.close()
