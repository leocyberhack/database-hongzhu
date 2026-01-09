"""时间工具函数"""
from datetime import datetime, timezone, timedelta

# 中国时区 UTC+8
CHINA_TZ = timezone(timedelta(hours=8))


def now_china() -> datetime:
    """获取中国时区的当前时间（带时区信息）"""
    return datetime.now(CHINA_TZ)


def now_china_naive() -> datetime:
    """获取中国时区的当前时间（不带时区信息，用于不支持时区的字段）"""
    return datetime.now(CHINA_TZ).replace(tzinfo=None)
