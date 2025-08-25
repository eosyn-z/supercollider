@echo off
echo ==================================
echo SuperCollider Setup Script
echo ==================================
echo.

echo Installing UI dependencies...
cd src-ui
call npm install
if %errorlevel% neq 0 (
    echo Failed to install UI dependencies
    pause
    exit /b %errorlevel%
)

echo.
echo Building UI for production...
call npm run build
if %errorlevel% neq 0 (
    echo Failed to build UI
    pause
    exit /b %errorlevel%
)

echo.
echo Installing Rust dependencies...
cd ..\src-tauri
cargo build --release
if %errorlevel% neq 0 (
    echo Failed to build Rust backend
    pause
    exit /b %errorlevel%
)

cd ..
echo.
echo ==================================
echo Setup Complete!
echo ==================================
echo.
echo To run in development mode:
echo   cargo tauri dev
echo.
echo To build for production:
echo   cargo tauri build
echo.
pause