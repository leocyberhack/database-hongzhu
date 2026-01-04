@echo off
setlocal

rem Resolve repo root (folder of this script)
set "repoRoot=%~dp0"
set "backend=%repoRoot%backend"
set "frontend=%repoRoot%frontend"

rem Backend: run uvicorn in a new window, prefer venv python if present
start "backend" cmd /k "cd /d ""%backend%"" && set PYTHONPATH=. && if exist "".venv\Scripts\python.exe"" ( "".venv\Scripts\python.exe"" -m alembic upgrade head && "".venv\Scripts\python.exe"" -m uvicorn app.main:app --reload --port 8000 ) else ( python -m alembic upgrade head && python -m uvicorn app.main:app --reload --port 8000 )"

rem Frontend: run Vite dev server in a new window with preset API envs
start "frontend" cmd /k "cd /d ""%frontend%"" && set VITE_API_BASE=http://127.0.0.1:8000 && npm run dev"

endlocal
