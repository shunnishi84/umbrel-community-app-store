import logging
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import database
from .routers import results as results_router
from .routers import settings as settings_router
from .scheduler import MEASUREMENT_INTERVAL_MINUTES, measurement_job

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        measurement_job,
        trigger=IntervalTrigger(minutes=MEASUREMENT_INTERVAL_MINUTES),
        id="speedtest_job",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started: interval=%d min", MEASUREMENT_INTERVAL_MINUTES
    )
    # Run immediately on startup so data appears right away.
    scheduler.add_job(measurement_job, id="speedtest_initial")
    app.state.scheduler = scheduler
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


app = FastAPI(title="SpeedTest Monitor", lifespan=lifespan)
app.include_router(results_router.router)
app.include_router(settings_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")
