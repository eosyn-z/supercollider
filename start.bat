@echo off
echo Starting Supercollider AI Orchestration Platform...
echo.

echo Starting backend server...
start "Supercollider Server" cmd /k "cd server && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting frontend client...
start "Supercollider Client" cmd /k "cd client && npm run dev"

echo.
echo Both services are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo WebSocket: ws://localhost:3000/ws
echo.
echo Press any key to exit...
pause > nul