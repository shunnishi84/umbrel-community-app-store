import logging
import os
import threading

import speedtest

from .database import insert_result, purge_old

logger = logging.getLogger(__name__)

MEASUREMENT_INTERVAL_MINUTES = int(
    os.environ.get("MEASUREMENT_INTERVAL_MINUTES", "15")
)

_measurement_lock = threading.Lock()
_measuring = False


def is_measuring() -> bool:
    return _measuring


def run_speedtest() -> dict:
    st = speedtest.Speedtest()
    st.get_best_server()
    st.download()
    st.upload()
    result = st.results.dict()
    return {
        "download_mbps": result["download"] / 1_000_000,
        "upload_mbps": result["upload"] / 1_000_000,
        "ping_ms": result["ping"],
        "server_name": result["server"]["name"],
    }


def measurement_job() -> None:
    global _measuring
    if not _measurement_lock.acquire(blocking=False):
        logger.info("Measurement already in progress, skipping")
        return
    _measuring = True
    try:
        logger.info("Starting speedtest measurement")
        try:
            data = run_speedtest()
            insert_result(
                download_mbps=data["download_mbps"],
                upload_mbps=data["upload_mbps"],
                ping_ms=data["ping_ms"],
                server_name=data["server_name"],
            )
            logger.info(
                "Measurement done: DL=%.2f Mbps UL=%.2f Mbps ping=%.1f ms",
                data["download_mbps"],
                data["upload_mbps"],
                data["ping_ms"],
            )
        except Exception as e:
            logger.exception("Speedtest failed: %s", e)
            try:
                insert_result(0.0, 0.0, 0.0, None, error=str(e))
            except Exception:
                logger.exception("Failed to record error row")

        try:
            deleted = purge_old()
            if deleted:
                logger.info("Purged %d old records", deleted)
        except Exception:
            logger.exception("Failed to purge old records")
    finally:
        _measuring = False
        _measurement_lock.release()
