@echo off
setlocal

set "APP_DIR=D:\workspaces\video_ui"
set "JAR=%APP_DIR%\ar44.jar"

if /I "%~1"=="-start" goto :start
if /I "%~1"=="-stop" goto :stop
if /I "%~1"=="-status" goto :status
if /I "%~1"=="-restart" goto :restart

echo Usage: arcad44 -start ^| -stop ^| -restart ^| -status
exit /b 1

:start
call :isrunning
if "%FOUND%"=="1" (
    echo Ar44 tourne deja.
    exit /b 0
)
echo Demarrage de Ar44...
start "Ar44" /D "%APP_DIR%" /MIN java -jar "%JAR%"
echo Ar44 demarre. Ouvre http://localhost:8080
exit /b 0

:stop
echo Arret de Ar44...
for /f "skip=1 tokens=1" %%P in ('wmic process where "Name='java.exe' and CommandLine like '%%ar44.jar%%'" get ProcessId 2^>nul') do (
    if not "%%P"=="" taskkill /PID %%P /F >nul 2>&1
)
echo Ar44 arrete.
exit /b 0

:restart
call :stop
timeout /t 2 /nobreak >nul
call :start
exit /b 0

:status
call :isrunning
if "%FOUND%"=="1" (
    echo Ar44 est en cours d'execution.
) else (
    echo Ar44 n'est pas demarre.
)
exit /b 0

:isrunning
set "FOUND=0"
for /f "skip=1 tokens=1" %%P in ('wmic process where "Name='java.exe' and CommandLine like '%%ar44.jar%%'" get ProcessId 2^>nul') do (
    if not "%%P"=="" set "FOUND=1"
)
exit /b 0
