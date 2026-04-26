import os
import time
import redis
from typing import List

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# socket_connect_timeout ensures failed connections fail instantly
# instead of hanging for seconds
client = redis.from_url(
    REDIS_URL,
    decode_responses=True,
    socket_connect_timeout=1,
    socket_timeout=1
)

def push_transaction(vpa: str, amount: float) -> None:
    try:
        key = f"history:{vpa}"
        client.lpush(key, str(amount))
        client.ltrim(key, 0, 99)
    except Exception as e:
        print(f"DEBUG [redis_client push_transaction error]: {e}")

def get_recent_transactions(vpa: str, limit: int = 100) -> List[float]:
    try:
        key = f"history:{vpa}"
        amounts_str = client.lrange(key, 0, limit - 1)
        return [float(amt) for amt in amounts_str]
    except Exception as e:
        print(f"DEBUG [redis_client get_recent_transactions error]: {e}")
        return []

def record_transaction_time(vpa: str) -> None:
    try:
        key = f"velocity:{vpa}"
        now = time.time()
        client.zadd(key, {str(now): now})
        cutoff = now - 300
        client.zremrangebyscore(key, "-inf", cutoff)
    except Exception as e:
        print(f"DEBUG [redis_client record_transaction_time error]: {e}")

def get_velocity(vpa: str, window_seconds: int = 60) -> int:
    try:
        key = f"velocity:{vpa}"
        now = time.time()
        start_time = now - window_seconds
        return client.zcount(key, start_time, "+inf")
    except Exception as e:
        print(f"DEBUG [redis_client get_velocity error]: {e}")
        return 0