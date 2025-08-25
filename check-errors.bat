@echo off
echo Checking for TypeScript errors...
echo.
cd src-ui
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo.
    echo TypeScript errors found! Please fix them before running the app.
) else (
    echo No TypeScript errors found!
)
cd ..
pause