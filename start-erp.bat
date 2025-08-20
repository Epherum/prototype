@echo off
echo Starting ERP Application...
echo.
cd /d C:\work\ERP
docker-compose up -d
echo.
echo ERP Application is starting up...
echo Please wait a few minutes for the containers to be ready.
echo.
echo Once ready, open your browser and go to: http://localhost:3000
echo.
echo To stop the application, run: docker-compose down
echo.
pause