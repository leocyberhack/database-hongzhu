import sys
import os
import asyncio
from fastapi.routing import APIRoute

# Add backend directory to sys.path
sys.path.append(os.getcwd())

from app.main import app

def print_routes():
    print("Listing all registered routes:")
    for route in app.routes:
        if isinstance(route, APIRoute):
            print(f"{route.methods} {route.path}")

if __name__ == "__main__":
    print_routes()
