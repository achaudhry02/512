$ErrorActionPreference = "Stop"

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "node")) {
  Write-Host "Node.js is required but was not found." -ForegroundColor Red
  Write-Host "Install Node.js from https://nodejs.org/ and run this script again."
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-Command "npm")) {
  Write-Host "npm is required but was not found." -ForegroundColor Red
  Write-Host "Reinstall Node.js from https://nodejs.org/ and run this script again."
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm install
}

Write-Host "Starting Convenience Store Command Center..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"
npm run dev
