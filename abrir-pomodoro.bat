@echo off
REM ============================================================================
REM abrir-pomodoro.bat
REM Duplo clique: sobe servidor estatico em http://localhost:8080 + abre browser
REM Ctrl+C ou fechar a janela encerra o servidor (sem orfaos).
REM ============================================================================

chcp 65001 >nul
title Pomodoro Premium
pushd "%~dp0"

echo.
echo  ====================================================
echo   Pomodoro rodando em http://localhost:8080
echo   Feche esta janela para encerrar.
echo  ====================================================
echo.

REM ---- Verifica Python no PATH ----
where python >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Python nao encontrado no PATH.
    echo Instale Python 3.x: https://www.python.org/downloads/
    echo Durante a instalacao, marque "Add Python to PATH".
    echo.
    pause
    popd
    exit /b 1
)

REM ---- Abre navegador apos 2s em janela auxiliar minimizada ----
REM Janela auxiliar fecha sozinha apos abrir o browser. Sem processos orfaos.
start "abrir-browser" /MIN cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8080"

REM ---- Servidor em primeiro plano ----
REM Bloqueia esta janela. Ctrl+C interrompe. Fechar janela mata o Python anexo.
python -m http.server 8080

echo.
echo Servidor encerrado.
popd
endlocal
