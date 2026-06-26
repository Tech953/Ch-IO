@echo off
REM ENGRAM / PYRI - start fully locally (Windows double-click wrapper)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
