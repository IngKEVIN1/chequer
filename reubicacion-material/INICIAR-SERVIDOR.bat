@echo off
title Reubicacion de material - servidor local
cd /d "%~dp0"
echo Iniciando servidor local en http://localhost:8080 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-local.ps1"
if errorlevel 1 pause
