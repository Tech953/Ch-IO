@echo off
REM ENGRAM / PYRI - one-time local setup (Windows double-click wrapper)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
