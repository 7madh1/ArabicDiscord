@echo off
chcp 65001 >nul
set "LOCAL_PS1=%~dp0install.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path $env:LOCAL_PS1) { & $env:LOCAL_PS1 } else { $code = Invoke-RestMethod -Uri 'https://raw.githubusercontent.com/7madh1/ArabicDiscord/main/install.ps1' -UseBasicParsing; Invoke-Expression $code }"
exit /b %ERRORLEVEL%
