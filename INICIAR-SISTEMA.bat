@echo off
title Canal de Parcerias - Sistema de Indicacoes e Comissoes
cd /d "%~dp0"

echo ============================================================
echo   CANAL DE PARCERIAS - Sistema de Indicacoes e Comissoes
echo ============================================================
echo.
echo   Iniciando o sistema... aguarde alguns segundos.
echo   O seu navegador vai abrir sozinho em: http://localhost:5178
echo.
echo   IMPORTANTE:
echo   - NAO feche esta janela preta enquanto estiver usando o sistema.
echo   - Para FECHAR o sistema, feche esta janela (ou aperte Ctrl+C).
echo.

if not exist "node_modules" (
  echo   Primeira execucao: instalando componentes, pode levar 1-2 minutos...
  call npm install
)

rem Abre o navegador automaticamente depois que o servidor sobe
start "" cmd /c "timeout /t 6 >nul & start "" http://localhost:5178"

call npm run dev -- --port=5178 --host=127.0.0.1

echo.
echo   O sistema foi encerrado. Pode fechar esta janela.
pause
