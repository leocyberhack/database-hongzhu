import asyncio
import sys
import os

# Add current directory to sys.path (run this script from backend directory)
sys.path.append(os.getcwd())

from sqlalchemy import select
from app.core.database import SessionLocal
from app.models import User

async def list_all_users():
    print("=== All Users in Database ===\n")
    async with SessionLocal() as session:
        users = await session.scalars(select(User).order_by(User.id))
        users_list = list(users)
        
        if not users_list:
            print("No users found in database!")
            return
        
        for user in users_list:
            print(f"ID: {user.id}")
            print(f"Username: {user.username}")
            print(f"Role: {user.role}")
            print(f"Password Hash: {user.password_hash[:20]}...")
            print(f"Created At: {user.created_at}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(list_all_users())
