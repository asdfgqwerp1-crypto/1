@echo off
cd /d "%~dp0"
echo.
echo  HTTPS server for camera tests (required on iPhone)
echo.
if exist "%~dp0certs\server.pem" if exist "%~dp0certs\server-key.pem" goto :run
where openssl >nul 2>&1
if errorlevel 1 (
  echo  ERROR: openssl not found and certs not generated yet.
  echo.
  echo  ВАРИАНТ 1 ^(рекомендуется^): запустите на Linux VM:
  echo    Scripts/start-all-linux.sh
  echo.
  echo  ВАРИАНТ 2: один раз сгенерировать сертификат в Linux VM,
  echo    папка Scripts/certs/ появится автоматически.
  echo.
  echo  ВАРИАНТ 3: установить Git for Windows ^(включает openssl^)
  pause
  exit /b 1
)
python "%~dp0start-test-server-https.py" 8443
if errorlevel 1 py "%~dp0start-test-server-https.py" 8443
goto :end
:run
python "%~dp0start-test-server-https.py" 8443
if errorlevel 1 py "%~dp0start-test-server-https.py" 8443
:end
pause