from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.auth import User, get_current_user, hash_user_password, verify_user_password, require_roles
from app.api.deps import DbSession
from app.core.security import create_access_token
from app.models import User as UserModel
from app.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserRead, RoleUpdate, PasswordReset

from app.core.login_tracker import login_tracker

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DbSession):
    # 检查账户是否被锁定
    is_locked, locked_until = login_tracker.is_locked(payload.username)
    if is_locked:
        remaining_seconds = login_tracker.get_remaining_lockout_seconds(payload.username)
        remaining_minutes = remaining_seconds // 60
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"账户已被锁定，请在 {remaining_minutes} 分钟 {remaining_seconds % 60} 秒后重试"
        )
    
    # 验证用户凭证
    user = await db.scalar(select(UserModel).where(UserModel.username == payload.username))
    if not user or not verify_user_password(payload.password, user.password_hash):
        # 记录失败
        lockout_minutes = login_tracker.record_failure(payload.username)
        if lockout_minutes > 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"密码错误次数过多，账户已被锁定 {int(lockout_minutes)} 分钟"
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    
    # 登录成功，重置失败计数
    login_tracker.record_success(payload.username)
    token = create_access_token(user.username, user.role)
    return TokenResponse(access_token=token, token_type="bearer", user=UserRead.model_validate(user))


@router.get("/auth/me", response_model=UserRead)
async def me(db: DbSession, current: User = Depends(get_current_user)):
    db_user = await db.scalar(select(UserModel).where(UserModel.username == current.username))
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return UserRead.model_validate(db_user)


@router.post("/auth/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserCreate, db: DbSession, _: User = Depends(require_roles(["super_admin"]))):
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
async def list_users(db: DbSession, _: User = Depends(require_roles(["super_admin"]))):
    rows = await db.scalars(select(UserModel).order_by(UserModel.id))
    return [UserRead.model_validate(u) for u in rows]


@router.put("/auth/users/{user_id}/role", response_model=UserRead)
async def update_user_role(
    user_id: int,
    payload: RoleUpdate,
    db: DbSession,
    _: User = Depends(require_roles(["super_admin"])),
):
    user = await db.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.put("/auth/users/{user_id}/password", response_model=UserRead)
async def reset_user_password(
    user_id: int,
    payload: PasswordReset,
    db: DbSession,
    _: User = Depends(require_roles(["super_admin"])),
):
    user = await db.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    user.password_hash = hash_user_password(payload.new_password)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.delete("/auth/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: DbSession,
    current: User = Depends(require_roles(["super_admin"])),
):
    user = await db.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # Prevent deleting yourself
    if user.username == current.username:
        raise HTTPException(status_code=400, detail="不能删除自己的账号")
    
    await db.delete(user)
    await db.commit()


@router.post("/auth/users/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_users(
    user_ids: list[int],
    db: DbSession,
    current: User = Depends(require_roles(["super_admin"])),
):
    if not user_ids:
        raise HTTPException(status_code=400, detail="未提供用户ID")
    
    # Get all users to delete
    users = await db.scalars(select(UserModel).where(UserModel.id.in_(user_ids)))
    users_list = list(users)
    
    # Check if trying to delete yourself
    for user in users_list:
        if user.username == current.username:
            raise HTTPException(status_code=400, detail="不能删除自己的账号")
    
    # Delete all
    for user in users_list:
        await db.delete(user)
    
    await db.commit()
