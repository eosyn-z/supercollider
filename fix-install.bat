@echo off
echo ==================================
echo Fixing SuperCollider Installation
echo ==================================
echo.

cd src-ui

echo Cleaning old installations...
if exist node_modules (
    echo Removing old node_modules...
    rmdir /s /q node_modules
)
if exist package-lock.json (
    echo Removing package-lock.json...
    del package-lock.json
)

echo.
echo Installing all dependencies fresh...
echo.

echo [1/3] Installing base dependencies...
call npm install

echo.
echo [2/3] Installing UI framework dependencies...
call npm install -D tailwindcss postcss autoprefixer
call npm install react-router-dom lucide-react clsx framer-motion react-hot-toast zustand

echo.
echo [3/3] Installing Radix UI components...
call npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-dropdown-menu @radix-ui/react-switch @radix-ui/react-tooltip @radix-ui/react-progress @radix-ui/react-accordion

echo.
echo Installing React Flow for visualization...
call npm install reactflow

echo.
echo ==================================
echo Installation Complete!
echo ==================================
echo.
echo Testing the installation...
echo.

cd ..
echo Starting SuperCollider...
cargo tauri dev