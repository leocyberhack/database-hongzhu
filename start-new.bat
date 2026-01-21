@echo off
setlocal

rem Resolve repo root (folder of this script)
set "repoRoot=%~dp0"
set "backend=%repoRoot%backend"
set "frontend=%repoRoot%frontend"

rem Backend: install deps, run migrations, start uvicorn
start "backend" cmd /k "cd /d "%backend%" && set PYTHONPATH=. && .venv\Scripts\pip install minio -q && .venv\Scripts\python -m alembic upgrade head && .venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"

rem Frontend: run Vite dev server in a new window with preset API envs
start "frontend" cmd /k "cd /d "%frontend%" && set VITE_API_BASE=http://127.0.0.1:8000 && npm run dev"

endlocal
