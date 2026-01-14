from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import api_router
from app.core.config import get_settings
from app.core.database import lifespan
from app.core.oplog import current_operator, extract_operator_from_headers

# 允许的来源列表（开发环境）
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
    "http://192.168.0.74:5175",
]


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
    
    # Allow local front-end dev server to call the API.
    # 注意：CORS 中间件必须在其他中间件之前添加
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    @app.middleware("http")
    async def set_operator_context(request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
            
        username = extract_operator_from_headers(request.headers)
        current_operator.set(username)
        response = await call_next(request)
        return response
    
    app.include_router(api_router, prefix=settings.api_prefix)
    
    # Global exception handler to ensure CORS headers are always returned
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        import traceback
        traceback.print_exc()  # Log the full traceback
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc)},
        )
    
    return app


app = create_app()
