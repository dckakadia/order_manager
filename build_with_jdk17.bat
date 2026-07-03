@echo off
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0frontend\android"
gradlew.bat assembleDebug
echo EXITCODE=%ERRORLEVEL%
exit /b %ERRORLEVEL%