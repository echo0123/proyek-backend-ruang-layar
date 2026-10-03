@echo off
title Ruang Layar Launcher
echo Menyalakan Server Backend Ruang Layar...
start cmd /k "node server.js"
timeout /t 2 >nul
echo Membuka Website di Browser...
start index.html
exit