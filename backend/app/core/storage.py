"""
MinIO 对象存储客户端
"""
from minio import Minio
from minio.error import S3Error
from io import BytesIO
import uuid
from datetime import datetime
from app.core.config import get_settings

# 获取配置
settings = get_settings()
MINIO_ENDPOINT = settings.minio_endpoint
MINIO_ACCESS_KEY = settings.minio_access_key
MINIO_SECRET_KEY = settings.minio_secret_key
MINIO_BUCKET = settings.minio_bucket
MINIO_PUBLIC_URL = settings.minio_public_url
MINIO_SECURE = settings.minio_secure


def get_minio_client() -> Minio:
    """获取 MinIO 客户端"""
    return Minio(
        endpoint=MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE  # 内网用 HTTP，公网用 HTTPS
    )


def ensure_bucket_exists(client: Minio, bucket_name: str):
    """确保 Bucket 存在"""
    policy = f'''{{
        "Version": "2012-10-17",
        "Statement": [{{
            "Effect": "Allow",
            "Principal": {{"AWS": "*"}},
            "Action": ["s3:GetObject"],
            "Resource": ["arn:aws:s3:::{bucket_name}/*"]
        }}]
    }}'''
    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)
    # 设置 Bucket 为公开读取（用于图片访问）
    client.set_bucket_policy(bucket_name, policy)


def upload_file(file_data: bytes, filename: str, content_type: str = "application/octet-stream") -> dict:
    """
    上传文件到 MinIO
    
    Returns:
        dict: {"object_name": "...", "url": "...", "size": ...}
    """
    client = get_minio_client()
    ensure_bucket_exists(client, MINIO_BUCKET)
    
    # 生成唯一文件名 (保留原始扩展名)
    ext = filename.split(".")[-1] if "." in filename else ""
    date_prefix = datetime.now().strftime("%Y/%m/%d")
    unique_name = f"{date_prefix}/{uuid.uuid4().hex}"
    if ext:
        unique_name += f".{ext}"
    
    # 上传文件
    file_stream = BytesIO(file_data)
    file_size = len(file_data)
    
    client.put_object(
        bucket_name=MINIO_BUCKET,
        object_name=unique_name,
        data=file_stream,
        length=file_size,
        content_type=content_type
    )
    
    # 构建公网访问 URL
    public_url = f"{MINIO_PUBLIC_URL}/{MINIO_BUCKET}/{unique_name}"
    
    return {
        "object_name": unique_name,
        "url": public_url,
        "size": file_size,
        "content_type": content_type,
        "original_filename": filename
    }


def delete_file(object_name: str) -> bool:
    """删除文件"""
    try:
        client = get_minio_client()
        client.remove_object(MINIO_BUCKET, object_name)
        return True
    except S3Error:
        return False
