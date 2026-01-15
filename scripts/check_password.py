import asyncio
import sys
import os

# Add project root to sys.path
# Add current directory to sys.path (run this script from backend directory)
sys.path.append(os.getcwd())

from sqlalchemy import select
from app.core.database import SessionLocal
from app.models import User
from app.core.security import verify_password

async def check_admin_password():
    print("Checking admin password...")
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.username == "admin"))
        if not user:
            print("❌ User 'admin' NOT FOUND in database!")
            return
        
        print(f"✅ User 'admin' found. Role: {user.role}")
        print(f"Current Password Hash: {user.password_hash[:10]}...")
        
        target_password = "dongyu1220"
        is_valid = verify_password(target_password, user.password_hash)
        
        if is_valid:
            print(f"✅ Password '{target_password}' is CORRECT.")
        else:
            print(f"❌ Password '{target_password}' is INCORRECT.")

if __name__ == "__main__":
    asyncio.run(check_admin_password())
