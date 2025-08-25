@echo off
echo ==================================
echo SuperCollider Diagnostic Tool
echo ==================================
echo.

echo Checking Node.js version...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

echo.
echo Checking npm version...
npm --version
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed
    pause
    exit /b 1
)

echo.
echo Checking Rust installation...
rustc --version
if %errorlevel% neq 0 (
    echo ERROR: Rust is not installed
    pause
    exit /b 1
)

echo.
echo Checking Cargo...
cargo --version
if %errorlevel% neq 0 (
    echo ERROR: Cargo is not installed
    pause
    exit /b 1
)

echo.
echo Checking for node_modules in src-ui...
if exist "src-ui\node_modules" (
    echo OK: node_modules exists
) else (
    echo WARNING: node_modules not found. Run: cd src-ui && npm install
)

echo.
echo Checking for Tauri CLI...
cd src-ui
call npx tauri --version
if %errorlevel% neq 0 (
    echo WARNING: Tauri CLI not found
)
cd ..

echo.
echo ==================================
echo Running Quick Tests
echo ==================================
echo.

echo Starting Vite dev server test...
echo Navigate to http://localhost:5173 in your browser
echo Press Ctrl+C to stop
echo.
cd src-ui
npm run dev