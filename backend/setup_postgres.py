"""
setup_postgres.py – One-time PostgreSQL database setup for Knowlify.

Usage:
    cd backend
    python setup_postgres.py

Prerequisites:
    1. PostgreSQL must be installed and running on localhost:5432
    2. pip install psycopg2-binary   (already in requirements.txt)

What this script does:
    1. Connects to the default 'postgres' database
    2. Creates the 'knowlify' database if it doesn't exist
    3. Connects to 'knowlify' and creates all tables via SQLAlchemy
"""
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(__file__))

def main():
    print("=" * 60)
    print("  Knowlify – PostgreSQL Database Setup")
    print("=" * 60)

    # ------------------------------------------------------------------
    # Step 1: Check psycopg2
    # ------------------------------------------------------------------
    try:
        import psycopg2
        print("[✓] psycopg2 is installed")
    except ImportError:
        print("[✗] psycopg2 is NOT installed.")
        print("    Run: pip install psycopg2-binary")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Step 2: Read connection settings from .env
    # ------------------------------------------------------------------
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url.startswith("postgresql"):
        print(f"[✗] DATABASE_URL is not PostgreSQL: {db_url}")
        print("    Set DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/knowlify in .env")
        sys.exit(1)

    # Parse out components
    # Format: postgresql://user:password@host:port/dbname
    from urllib.parse import urlparse
    parsed = urlparse(db_url)
    pg_user = parsed.username or "postgres"
    pg_pass = parsed.password or ""
    pg_host = parsed.hostname or "localhost"
    pg_port = parsed.port or 5432
    pg_db   = parsed.path.lstrip("/") or "knowlify"

    print(f"[i] Target: {pg_user}@{pg_host}:{pg_port}/{pg_db}")

    # ------------------------------------------------------------------
    # Step 3: Connect to 'postgres' and create the target database
    # ------------------------------------------------------------------
    print(f"\n[…] Connecting to PostgreSQL at {pg_host}:{pg_port} ...")
    try:
        conn = psycopg2.connect(
            host=pg_host,
            port=pg_port,
            user=pg_user,
            password=pg_pass,
            dbname="postgres",
        )
        conn.autocommit = True
        print("[✓] Connected to PostgreSQL server")
    except psycopg2.OperationalError as e:
        print(f"[✗] Cannot connect to PostgreSQL: {e}")
        print("\nMake sure:")
        print("  1. PostgreSQL is installed and running")
        print("  2. The password in .env matches your 'postgres' superuser password")
        print(f"  3. Port {pg_port} is not blocked")
        sys.exit(1)

    cur = conn.cursor()

    # Check if database already exists
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (pg_db,))
    exists = cur.fetchone()

    if exists:
        print(f"[✓] Database '{pg_db}' already exists")
    else:
        print(f"[…] Creating database '{pg_db}' ...")
        cur.execute(f'CREATE DATABASE "{pg_db}"')
        print(f"[✓] Database '{pg_db}' created")

    cur.close()
    conn.close()

    # ------------------------------------------------------------------
    # Step 4: Enable uuid-ossp extension
    # ------------------------------------------------------------------
    print(f"\n[…] Enabling UUID extension in '{pg_db}' ...")
    conn2 = psycopg2.connect(
        host=pg_host,
        port=pg_port,
        user=pg_user,
        password=pg_pass,
        dbname=pg_db,
    )
    conn2.autocommit = True
    cur2 = conn2.cursor()
    cur2.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    print('[✓] Extension "uuid-ossp" enabled')
    cur2.close()
    conn2.close()

    # ------------------------------------------------------------------
    # Step 5: Create all SQLAlchemy tables
    # ------------------------------------------------------------------
    print(f"\n[…] Creating tables via SQLAlchemy ...")

    # Force reload database module with PostgreSQL URL
    os.environ["DATABASE_URL"] = db_url
    from app.database import init_db, Base, engine

    init_db()

    # List tables
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"\n[✓] {len(tables)} tables ready in '{pg_db}':")
    for t in sorted(tables):
        print(f"    • {t}")

    print("\n" + "=" * 60)
    print("  Setup complete! You can now run:")
    print("    uvicorn app.main:app --reload --port 8000")
    print("=" * 60)


if __name__ == "__main__":
    main()
