@echo off
echo Cleaning up...
del /F dist\*.ico 2>NUL
del /F dist\*.mp3 2>NUL
del /F dist\*.LICENSE.txt 2>NUL
del /F dist\*.js 2>NUL
del /F dist\*.html 2>NUL
del /F dist\*.css 2>NUL
call yarn
call yarn build
echo Building sneaker.exe ...
go build -o sneaker.exe cmd\sneaker-server\main.go
echo Done.
