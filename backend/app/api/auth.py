from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models import User as UserModel


class User(BaseModel):
    username: str
    role: str


DbDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbDep,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_user: str | None = Header(default=None, alias="X-User"),
    x_role: str | None = Header(default=None, alias="X-Role"),
) -> User:
    """
    优先使用 Authorization: Bearer <JWT>；兼容旧的 X-User/X-Role。
    """
    settings = get_settings()
    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if token:
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            username: str | None = payload.get("sub")
            role: str | None = payload.get("role") or "guest"
            if not username:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
            return User(username=username, role=role)
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if not x_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
    db_user = await db.scalar(select(UserModel).where(UserModel.username == x_user))
    role = db_user.role if db_user else (x_role or "guest")
    return User(username=x_user, role=role)


def require_roles(roles: list[str]):
    async def checker(user: User = Depends(get_current_user)) -> User:
        # Super admin has all permissions
        if user.role == "super_admin":
            return user
            
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return checker


def hash_user_password(plain: str) -> str:
    return hash_password(plain)


def verify_user_password(plain: str, hashed: str) -> bool:
    return verify_password(plain, hashed)
