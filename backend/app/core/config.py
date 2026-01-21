from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ota-backend"
    debug: bool = True
    api_prefix: str = "/api"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 3

    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_name: str = "ota_dev"
    db_pool_size: int = 10
    db_pool_timeout: int = 30

    # MinIO 文件存储配置
    minio_endpoint: str = "minio.zeabur.internal:9000"
    minio_access_key: str = "minio"
    minio_secret_key: str = ""
    minio_bucket: str = "zeabur"
    minio_public_url: str = "https://hongzhuwenjiancunchu.zeabur.app"
    minio_secure: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def sqlalchemy_database_uri(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
