import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from .. import database
from ..scheduler import is_measuring, measurement_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["settings"])

_SECRET_KEYS = {"x_api_key", "x_api_secret", "x_access_token", "x_access_token_secret"}


class SettingsUpdate(BaseModel):
    machine_name: Optional[str] = None
    x_api_key: Optional[str] = None
    x_api_secret: Optional[str] = None
    x_access_token: Optional[str] = None
    x_access_token_secret: Optional[str] = None


@router.post("/measure")
def trigger_measure(background_tasks: BackgroundTasks):
    if is_measuring():
        raise HTTPException(status_code=409, detail="Measurement already in progress")
    background_tasks.add_task(measurement_job)
    return {"status": "started"}


@router.get("/measure/status")
def measure_status():
    return {"measuring": is_measuring()}


@router.get("/settings")
def get_settings():
    return {
        "machine_name": database.get_setting("machine_name", ""),
        "x_configured": bool(
            database.get_setting("x_api_key")
            and database.get_setting("x_access_token")
        ),
    }


@router.put("/settings")
def update_settings(body: SettingsUpdate):
    fields = body.model_dump(exclude_none=True)
    for key, value in fields.items():
        database.set_setting(key, value)
    return {"status": "ok"}


@router.post("/post-x")
def post_to_x():
    try:
        import tweepy
    except ImportError:
        raise HTTPException(status_code=500, detail="tweepy not installed")

    api_key = database.get_setting("x_api_key")
    api_secret = database.get_setting("x_api_secret")
    access_token = database.get_setting("x_access_token")
    access_token_secret = database.get_setting("x_access_token_secret")

    if not all([api_key, api_secret, access_token, access_token_secret]):
        raise HTTPException(status_code=400, detail="X API credentials not configured")

    latest = database.get_latest()
    if not latest:
        raise HTTPException(status_code=404, detail="No measurement data available")

    machine_name = database.get_setting("machine_name", "")
    machine_text = f" [{machine_name}]" if machine_name else ""

    text = (
        f"📊 Speed Test Result{machine_text}\n"
        f"↓ Download: {latest['download_mbps']:.1f} Mbps\n"
        f"↑ Upload: {latest['upload_mbps']:.1f} Mbps\n"
        f"⚡ Ping: {latest['ping_ms']:.0f} ms\n"
        f"#SpeedTest #Umbrel"
    )

    try:
        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )
        client.create_tweet(text=text)
        return {"status": "posted", "text": text}
    except Exception as e:
        logger.exception("Failed to post to X: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
