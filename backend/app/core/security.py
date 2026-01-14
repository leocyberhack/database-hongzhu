from datetime import datetime, timedelta
from typing import Any, Optional

from jose import jwt
import bcrypt

from app.core.config import get_settings


def verify_password(plain: str, hashed: str) -> bool:
    # bcrypt requires bytes
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        # Fallback or robust handling for different formats if needed
        # But for now, assume new bcrypt format
        return False


def hash_password(plain: str) -> str:
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_access_token(subject: str, role: str, expires_minutes: Optional[int] = None) -> str:
    settings = get_settings()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.access_token_expire_minutes)
    to_encode: dict[str, Any] = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
