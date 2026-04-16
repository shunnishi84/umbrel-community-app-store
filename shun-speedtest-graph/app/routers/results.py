import csv
import io
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import Response

from .. import database

router = APIRouter(prefix="/api", tags=["results"])


@router.get("/results/csv")
def results_csv(
    hours: Optional[int] = Query(default=24, ge=1, le=24 * 31),
    from_date: Optional[str] = Query(default=None),
    to_date: Optional[str] = Query(default=None),
):
    results = database.get_results(
        hours=hours,
        from_date=from_date,
        to_date=to_date,
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["measured_at", "download_mbps", "upload_mbps", "ping_ms", "server_name"])
    for r in results:
        writer.writerow([
            r["measured_at"],
            r["download_mbps"],
            r["upload_mbps"],
            r["ping_ms"],
            r.get("server_name") or "",
        ])

    filename = "speedtest"
    if from_date:
        filename += f"_{from_date}"
    if to_date:
        filename += f"_to_{to_date}"
    filename += ".csv"

    return Response(
        content="\ufeff" + output.getvalue(),  # BOM for Excel compatibility
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/results/latest")
def latest_result():
    return database.get_latest() or {}


@router.get("/results")
def list_results(
    hours: Optional[int] = Query(default=24, ge=1, le=24 * 31),
    from_date: Optional[str] = Query(default=None),
    to_date: Optional[str] = Query(default=None),
):
    return {
        "results": database.get_results(
            hours=hours,
            from_date=from_date,
            to_date=to_date,
        )
    }


@router.get("/stats")
def stats(
    hours: int = Query(default=24, ge=1, le=24 * 31),
    from_date: Optional[str] = Query(default=None),
    to_date: Optional[str] = Query(default=None),
):
    return {
        "stats": database.get_stats(
            hours=hours,
            from_date=from_date,
            to_date=to_date,
        )
    }
