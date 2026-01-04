from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

engine: AsyncEngine = create_async_engine(
    settings.sqlalchemy_database_uri,
    echo=settings.debug,
    pool_size=settings.db_pool_size,
    pool_timeout=settings.db_pool_timeout,
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@asynccontextmanager
async def lifespan(app):
    # Place for startup/shutdown hooks if needed.
    async with SessionLocal() as session:
        try:
            from app.models import User  # import here to avoid circular
            from app.api.auth import hash_user_password

            admin = await session.scalar(select(User).where(User.username == "admin"))
            if not admin:
                session.add(
                    User(
                        username="admin",
                        password_hash=hash_user_password("dongyu1220"),
                        role="admin",
                    )
                )
                await session.commit()
        except ProgrammingError:
            # User table may not exist yet (migration not run); skip seeding.
            await session.rollback()
        except Exception:
            await session.rollback()
            raise
    yield
    await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
