from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
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
    print(f"Connecting to DB: user={settings.db_user} host={settings.db_host} port={settings.db_port} db={settings.db_name}")
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

    def _format_loc(loc: tuple) -> str:
        if not loc:
            return "参数"
        source_map = {
            "body": "请求体",
            "query": "查询参数",
            "path": "路径参数",
            "header": "请求头",
            "cookie": "Cookie",
        }
        parts = [str(p) for p in loc]
        source = parts[0]
        rest = parts[1:]
        prefix = source_map.get(source, str(source))
        if rest:
            return f"{prefix}.{'.'.join(rest)}"
        return prefix

    def _format_message(err: dict) -> str:
        err_type = err.get("type", "")
        ctx = err.get("ctx") or {}

        if err_type in {"missing", "value_error.missing"}:
            return "字段不能为空"
        if err_type in {"json_invalid", "value_error.jsondecode"}:
            return "JSON 格式错误"
        if err_type in {"string_type"}:
            return "必须为字符串"
        if err_type in {"int_parsing", "int_type"}:
            return "必须为整数"
        if err_type in {"float_parsing", "float_type"}:
            return "必须为数字"
        if err_type in {"bool_parsing", "bool_type"}:
            return "必须为布尔值"
        if err_type in {"list_type"}:
            return "必须为列表"
        if err_type in {"dict_type"}:
            return "必须为对象"
        if err_type in {
            "datetime_from_date_parsing",
            "date_from_datetime_parsing",
            "datetime_parsing",
            "date_parsing",
            "time_parsing",
            "value_error.date",
            "value_error.datetime",
            "value_error.time",
        }:
            return "时间格式错误"
        if err_type in {"greater_than_equal", "greater_than", "less_than_equal", "less_than"}:
            if err_type == "greater_than_equal":
                limit = ctx.get("ge")
                return f"必须大于等于 {limit}" if limit is not None else "数值过小"
            if err_type == "greater_than":
                limit = ctx.get("gt")
                return f"必须大于 {limit}" if limit is not None else "数值过小"
            if err_type == "less_than_equal":
                limit = ctx.get("le")
                return f"必须小于等于 {limit}" if limit is not None else "数值过大"
            if err_type == "less_than":
                limit = ctx.get("lt")
                return f"必须小于 {limit}" if limit is not None else "数值过大"
        if err_type in {"string_too_short"}:
            limit = ctx.get("min_length")
            return f"长度不能小于 {limit}" if limit is not None else "长度过短"
        if err_type in {"string_too_long"}:
            limit = ctx.get("max_length")
            return f"长度不能大于 {limit}" if limit is not None else "长度过长"
        if err_type in {"literal_error", "enum", "enum_value"}:
            return "不在允许的取值范围内"
        if err_type in {"regex_pattern_mismatch", "value_error.regex"}:
            return "格式不符合要求"
        if err_type in {"url_parsing", "value_error.url"}:
            return "URL 格式错误"
        if err_type in {"value_error"} and ctx.get("error"):
            return str(ctx.get("error"))
        return "参数不合法"

    @app.exception_handler(RequestValidationError)
    async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = []
        for err in exc.errors():
            errors.append(
                {
                    "field": _format_loc(err.get("loc", ())),
                    "message": _format_message(err),
                }
            )
        return JSONResponse(
            status_code=422,
            content={
                "detail": "请求参数校验失败",
                "errors": errors,
            },
        )
    
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
