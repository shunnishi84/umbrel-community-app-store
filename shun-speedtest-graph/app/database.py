import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

DATABASE_PATH = os.environ.get("DATABASE_PATH", "/data/speedtest.db")
RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "31"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS speed_results (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    measured_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    download_mbps REAL NOT NULL,
    upload_mbps   REAL NOT NULL,
    ping_ms       REAL NOT NULL,
    server_name   TEXT,
    error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_measured_at ON speed_results(measured_at);
"""


def init_db() -> None:
    os.makedirs(os.path.dirname(DATABASE_PATH) or ".", exist_ok=True)
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        conn.commit()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DATABASE_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def insert_result(
    download_mbps: float,
    upload_mbps: float,
    ping_ms: float,
    server_name: Optional[str],
    error: Optional[str] = None,
) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO speed_results
              (measured_at, download_mbps, upload_mbps, ping_ms, server_name, error)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                download_mbps,
                upload_mbps,
                ping_ms,
                server_name,
                error,
            ),
        )
        conn.commit()
        return cur.lastrowid


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "measured_at": row["measured_at"],
        "download_mbps": row["download_mbps"],
        "upload_mbps": row["upload_mbps"],
        "ping_ms": row["ping_ms"],
        "server_name": row["server_name"],
        "error": row["error"],
    }


def get_results(hours: Optional[int] = None, limit: Optional[int] = None) -> list[dict]:
    query = "SELECT * FROM speed_results WHERE error IS NULL"
    params: list = []
    if hours is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        query += " AND measured_at >= ?"
        params.append(cutoff.strftime("%Y-%m-%d %H:%M:%S"))
    query += " ORDER BY measured_at ASC"
    if limit is not None:
        query += f" LIMIT {int(limit)}"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        return [_row_to_dict(r) for r in rows]


def get_latest() -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM speed_results WHERE error IS NULL "
            "ORDER BY measured_at DESC LIMIT 1"
        ).fetchone()
        return _row_to_dict(row) if row else None


def get_stats(hours: int = 24) -> dict:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT
              COUNT(*) AS count,
              AVG(download_mbps) AS avg_download,
              MAX(download_mbps) AS max_download,
              MIN(download_mbps) AS min_download,
              AVG(upload_mbps)   AS avg_upload,
              MAX(upload_mbps)   AS max_upload,
              MIN(upload_mbps)   AS min_upload,
              AVG(ping_ms)       AS avg_ping,
              MAX(ping_ms)       AS max_ping,
              MIN(ping_ms)       AS min_ping
            FROM speed_results
            WHERE error IS NULL AND measured_at >= ?
            """,
            (cutoff,),
        ).fetchone()
        return dict(row) if row else {}


def purge_old(retention_days: int = RETENTION_DAYS) -> int:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM speed_results WHERE measured_at < ?", (cutoff,)
        )
        conn.commit()
        return cur.rowcount
