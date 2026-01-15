import asyncio
import sys
import os

# Add current directory to sys.path (run this script from backend directory)
sys.path.append(os.getcwd())

from sqlalchemy import select
from app.core.database import SessionLocal
from app.models import User
from app.core.security import hash_password

async def reset_admin_password():
    new_password = "dongyu1220"
    
    print(f"Resetting admin password to: {new_password}")
    
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.username == "admin"))
        if not user:
            print("❌ User 'admin' NOT FOUND!")
            return
        
        print(f"✅ Found admin user (ID: {user.id})")
        print(f"Old password hash: {user.password_hash[:30]}...")
        
        # Use the current hash_password function (BCrypt)
        user.password_hash = hash_password(new_password)
        
        print(f"New password hash: {user.password_hash[:30]}...")
        
        await session.commit()
        print(f"✅ Password reset successfully!")
        print(f"Username: admin")
        print(f"Password: {new_password}")

if __name__ == "__main__":
    asyncio.run(reset_admin_password())
