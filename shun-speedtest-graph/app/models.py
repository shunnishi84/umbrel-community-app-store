from dataclasses import dataclass
from typing import Optional


@dataclass
class SpeedResult:
    id: int
    measured_at: str
    download_mbps: float
    upload_mbps: float
    ping_ms: float
    server_name: Optional[str]
    error: Optional[str]
