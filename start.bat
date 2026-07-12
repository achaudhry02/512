@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but was not found.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required but was not found.
  echo Reinstall Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Convenience Store Command Center...
start "" "http://localhost:3000"
call npm run dev

endlocal
