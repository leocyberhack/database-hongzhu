"""
登录失败跟踪和账户锁定管理
"""
from datetime import datetime, timedelta
from typing import Dict, Optional

class LoginAttemptTracker:
    """跟踪登录失败次数和账户锁定状态"""
    
    def __init__(self):
        # 存储格式: {username: {"failures": count, "locked_until": datetime, "lock_multiplier": int}}
        self._attempts: Dict[str, dict] = {}
        self.base_lockout_minutes = 5  # 基础锁定时间（分钟）
        self.max_multiplier = 5  # 最大翻倍次数
        self.failure_threshold = 3  # 失败阈值
    
    def is_locked(self, username: str) -> tuple[bool, Optional[datetime]]:
        """
        检查账户是否被锁定
        返回: (是否锁定, 锁定到期时间)
        """
        if username not in self._attempts:
            return False, None
        
        attempt_data = self._attempts[username]
        locked_until = attempt_data.get("locked_until")
        
        if locked_until and datetime.now() < locked_until:
            return True, locked_until
        
        # 锁定已过期，清除锁定状态
        if locked_until:
            attempt_data["locked_until"] = None
        
        return False, None
    
    def record_failure(self, username: str):
        """记录一次登录失败"""
        if username not in self._attempts:
            self._attempts[username] = {
                "failures": 0,
                "locked_until": None,
                "lock_multiplier": 0
            }
        
        attempt_data = self._attempts[username]
        attempt_data["failures"] += 1
        
        # 达到失败阈值，锁定账户
        if attempt_data["failures"] >= self.failure_threshold:
            # 计算锁定时间
            multiplier = min(attempt_data["lock_multiplier"], self.max_multiplier)
            lockout_minutes = self.base_lockout_minutes * (2 ** multiplier)
            locked_until = datetime.now() + timedelta(minutes=lockout_minutes)
            
            attempt_data["locked_until"] = locked_until
            attempt_data["lock_multiplier"] = multiplier + 1
            attempt_data["failures"] = 0  # 重置失败计数
            
            return lockout_minutes
        
        return 0
    
    def record_success(self, username: str):
        """记录一次成功登录，重置失败计数"""
        if username in self._attempts:
            # 保留lock_multiplier，只重置failures
            self._attempts[username]["failures"] = 0
            # 成功登录后清除锁定状态
            self._attempts[username]["locked_until"] = None
    
    def get_remaining_lockout_seconds(self, username: str) -> int:
        """获取剩余锁定秒数"""
        is_locked, locked_until = self.is_locked(username)
        if not is_locked or not locked_until:
            return 0
        
        remaining = (locked_until - datetime.now()).total_seconds()
        return max(0, int(remaining))


# 全局实例
login_tracker = LoginAttemptTracker()
