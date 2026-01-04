from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.auth import User, get_current_user, hash_user_password, verify_user_password, require_roles
from app.api.deps import DbSession
from app.core.security import create_access_token
from app.models import User as UserModel
from app.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserRead, RoleUpdate

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DbSession):
    user = await db.scalar(select(UserModel).where(UserModel.username == payload.username))
    if not user or not verify_user_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    token = create_access_token(user.username, user.role)
    return TokenResponse(access_token=token, token_type="bearer", user=UserRead.model_validate(user))


@router.get("/auth/me", response_model=UserRead)
async def me(db: DbSession, current: User = Depends(get_current_user)):
    db_user = await db.scalar(select(UserModel).where(UserModel.username == current.username))
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return UserRead.model_validate(db_user)


@router.post("/auth/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserCreate, db: DbSession, _: User = Depends(require_roles(["admin"]))):
    exists = await db.scalar(select(UserModel).where(UserModel.username == payload.username))
    if exists:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = UserModel(
        username=payload.username,
        password_hash=hash_user_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.get("/auth/users", response_model=list[UserRead])
async def list_users(db: DbSession, _: User = Depends(require_roles(["admin"]))):
    rows = await db.scalars(select(UserModel).order_by(UserModel.id))
    return [UserRead.model_validate(u) for u in rows]


@router.put("/auth/users/{user_id}/role", response_model=UserRead)
async def update_user_role(
    user_id: int,
    payload: RoleUpdate,
    db: DbSession,
    _: User = Depends(require_roles(["admin"])),
):
    user = await db.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)
