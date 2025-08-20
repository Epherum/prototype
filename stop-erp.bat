@echo off
echo Stopping ERP Application...
echo.
cd /d C:\work\ERP
docker-compose down
echo.
echo ERP Application has been stopped.
echo.
pause