@echo off
setlocal
set "DOCS_PREVIEW_ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $env:DOCS_PREVIEW_ROOT 'preview-docs.ps1'), [Text.Encoding]::UTF8)))"
if errorlevel 1 pause
endlocal
