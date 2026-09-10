@echo off
title Canal de Parcerias - Sistema de Indicacoes e Comissoes
cd /d "%~dp0"

echo ============================================================
echo   CANAL DE PARCERIAS - Sistema de Indicacoes e Comissoes
echo ============================================================
echo.
echo   Preparando o sistema... isso leva cerca de 30 segundos.
echo   Quando terminar, o navegador abre sozinho em:
echo       http://localhost:5178
echo.
echo   IMPORTANTE:
echo   - NAO feche esta janela preta enquanto estiver usando o sistema.
echo   - Para FECHAR o sistema, feche esta janela.
echo.

if not exist "node_modules" (
  echo   Primeira execucao: instalando componentes, pode levar 1-2 minutos...
  call npm install
)

echo   Compilando a versao estavel...
call npm run build
if errorlevel 1 (
  echo.
  echo   [ERRO] Nao foi possivel compilar o sistema agora.
  echo   Provavelmente uma alteracao no codigo esta em andamento.
  echo   Tente novamente em alguns minutos.
  echo.
  pause
  exit /b 1
)

rem Abre o navegador automaticamente assim que o servidor sobe
start "" cmd /c "timeout /t 4 >nul & start "" http://localhost:5178"

echo.
echo   Sistema pronto! Mantenha esta janela aberta.
call npm run preview -- --port=5178 --host=127.0.0.1

echo.
echo   O sistema foi encerrado. Pode fechar esta janela.
pause
