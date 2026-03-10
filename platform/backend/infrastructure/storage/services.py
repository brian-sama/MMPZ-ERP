from pathlib import Path

from django.conf import settings


def ensure_upload_directory(module: str) -> Path:
    path = Path(settings.MEDIA_ROOT) / module
    path.mkdir(parents=True, exist_ok=True)
    return path

