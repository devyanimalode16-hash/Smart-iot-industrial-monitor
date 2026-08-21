@echo off
title Smart IIoT Industrial Equipment Monitoring System
color 0b
echo ==============================================================================
echo    SMART IOT INDUSTRIAL EQUIPMENT MONITOR & FAULT DETECTION SYSTEM
echo    ENTC Engineering Final Year Simulation Platform
echo ==============================================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Python is not found in system PATH.
    echo [INFO] Launching in Zero-Dependency Direct Browser Mode...
    echo.
    start "" "%~dp0index.html"
    echo Dashboard opened in your default web browser!
    echo Press any key to exit this window...
    pause >nul
    exit /b
)

:: Create Virtual Environment if not exists
if not exist "venv" (
    echo [1/3] Creating Python virtual environment...
    python -m venv venv
)

:: Activate Virtual Environment
call venv\Scripts\activate

:: Install requirements
echo [2/3] Checking dependencies...
pip install -r requirements.txt --quiet

:: Launch Browser after brief delay
echo [3/3] Starting IIoT Telemetry Server at http://127.0.0.1:8000 ...
start "" "http://127.0.0.1:8000"

:: Run Uvicorn Server
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload

pause
