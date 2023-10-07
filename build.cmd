@echo off
set GOARCH=386

echo Cleaning up...
del sneaker.exe 2>NUL
del cmd\sneaker-server\resource.syso 2>NUL
del /F dist\*.ico 2>NUL
del /F dist\*.mp3 2>NUL
del /F dist\*.LICENSE.txt 2>NUL
del /F dist\*.js 2>NUL
del /F dist\*.html 2>NUL
del /F dist\*.css 2>NUL
go install github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest
call yarn
call yarn build
echo Building sneaker.exe ...
cd cmd\sneaker-server
go generate
go build -o ..\..\sneaker.exe
cd ..\..
echo Done.
