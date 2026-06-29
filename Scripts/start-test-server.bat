@echo off
cd /d "%~dp0..\TestPages"
echo.
echo  Test server starting from:
echo  %CD%
echo.
echo  Fingerprint (HTTP OK):
echo    http://YOUR_PC_IP:8080/fingerprint-diff/
echo.
echo  Camera / WebRTC (HTTPS required on iPhone):
echo    Scripts\start-test-server-https.bat
echo    https://YOUR_PC_IP:8443/webrtc-inspector/
echo.
echo  Find IP: ipconfig ^| findstr IPv4
echo.
python -m http.server 8080
if errorlevel 1 py -m http.server 8080