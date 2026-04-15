from typing import Optional

from fastapi import APIRouter, Query

from .. import database

router = APIRouter(prefix="/api", tags=["results"])


@router.get("/results")
def list_results(hours: Optional[int] = Query(default=24, ge=1, le=24 * 31)):
    return {"hours": hours, "results": database.get_results(hours=hours)}


@router.get("/results/latest")
def latest_result():
    return database.get_latest() or {}


@router.get("/stats")
def stats(hours: int = Query(default=24, ge=1, le=24 * 31)):
    return {"hours": hours, "stats": database.get_stats(hours=hours)}
