from datetime import datetime, timedelta
from typing import Any, Optional

from jose import jwt
import bcrypt

from app.core.config import get_settings


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify password against hash.
    Supports both BCrypt (current) and PBKDF2 (legacy) for backward compatibility.
    """
    import bcrypt
    
    # Try BCrypt first (current standard)
    if hashed.startswith('$2b$') or hashed.startswith('$2a$') or hashed.startswith('$2y$'):
        try:
            return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
        except Exception:
            return False
    
    # Try PBKDF2 (legacy format from old installations)
    if hashed.startswith('$pbkdf2'):
        try:
            from passlib.hash import pbkdf2_sha256
            return pbkdf2_sha256.verify(plain, hashed)
        except ImportError:
            # passlib not installed, cannot verify legacy hashes
            return False
        except Exception:
            return False
    
    # Unknown hash format
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
