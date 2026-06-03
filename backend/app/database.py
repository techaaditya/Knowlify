# Database connection helper using SQLAlchemy
# Exposes SessionLocal and Engine templates for future PostgreSQL + pgvector setups.

import os
from .config import settings

# In production, we'd run:
# from sqlalchemy import create_engine
# from sqlalchemy.orm import declarative_base, sessionmaker
# engine = create_engine(settings.DATABASE_URL)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()

def get_db():
    """
    Dependency generator for retrieving database session context.
    """
    # db = SessionLocal()
    # try:
    #     yield db
    # finally:
    #     db.close()
    yield None
